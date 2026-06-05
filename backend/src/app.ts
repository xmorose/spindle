import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { Database } from "better-sqlite3";
import { EventStore } from "./events/store.js";
import { NavidromeReader } from "./db/navidrome-db.js";
import { MemoCache } from "./cache.js";
import { registerIngest } from "./routes/ingest.js";
import { registerStats } from "./routes/stats.js";
import { registerAuth } from "./auth/index.js";
import { registerCover } from "./routes/cover.js";
import { registerStream } from "./routes/stream.js";
import { registerScrobble } from "./routes/scrobble.js";
import { registerEntity } from "./routes/entity.js";
import { registerShares } from "./routes/shares.js";
import { registerAlbumTracks } from "./routes/album.js";
import type { AuthConfig, CoverConfig } from "./config.js";

export interface Deps {
  statsDb: Database;
  reader: NavidromeReader;
  ingestSecret: string;
  sessionGapMinutes: number;
  defaultUser?: string;
  nowProvider?: () => number;
  trustProxy?: boolean;
  auth?: AuthConfig;
  cover?: CoverConfig;
  webDir?: string;
}

export function buildApp(deps: Deps): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: deps.trustProxy ?? false });
  const store = new EventStore(deps.statsDb);
  const cache = new MemoCache();
  const defaultUser = deps.defaultUser ?? "morose";

  const now = deps.nowProvider ?? (() => Math.floor(Date.now() / 1000));
  if (deps.auth) registerAuth(app, deps.auth, now);

  app.get("/health", async () => ({ status: "ok" }));
  registerIngest(app, { store, cache, secret: deps.ingestSecret, defaultUser });

  registerStats(app, {
    statsDb: deps.statsDb,
    reader: deps.reader,
    cache,
    now,
    sessionGapSeconds: deps.sessionGapMinutes * 60,
    defaultUser,
  });

  registerEntity(app, { statsDb: deps.statsDb, reader: deps.reader, cache, now, defaultUser });
  registerShares(app, { statsDb: deps.statsDb, reader: deps.reader, cover: deps.cover, now, webDir: deps.webDir });
  registerAlbumTracks(app, { reader: deps.reader });

  if (deps.cover) registerCover(app, deps.cover);
  if (deps.cover) registerStream(app, deps.cover);
  if (deps.cover) registerScrobble(app, deps.cover);

  app.decorate("spindle", { store, cache, reader: deps.reader, statsDb: deps.statsDb, sessionGapMinutes: deps.sessionGapMinutes });

  if (deps.webDir) {
    app.register(fastifyStatic, { root: deps.webDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api/") && !req.url.startsWith("/ingest") && req.url !== "/health") {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "not found" });
    });
  }

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    spindle: {
      store: import("./events/store.js").EventStore;
      cache: import("./cache.js").MemoCache;
      reader: import("./db/navidrome-db.js").NavidromeReader;
      statsDb: import("better-sqlite3").Database;
      sessionGapMinutes: number;
    };
  }
}
