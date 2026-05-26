import Fastify, { type FastifyInstance } from "fastify";
import type { Database } from "better-sqlite3";
import { EventStore } from "./events/store.js";
import { NavidromeReader } from "./db/navidrome-db.js";
import { MemoCache } from "./cache.js";
import { registerIngest } from "./routes/ingest.js";
import { registerStats } from "./routes/stats.js";

export interface Deps {
  statsDb: Database;
  reader: NavidromeReader;
  ingestSecret: string;
  sessionGapMinutes: number;
  defaultUser?: string;
  nowProvider?: () => number;
}

export function buildApp(deps: Deps): FastifyInstance {
  const app = Fastify({ logger: false });
  const store = new EventStore(deps.statsDb);
  const cache = new MemoCache();
  const defaultUser = deps.defaultUser ?? "morose";

  app.get("/health", async () => ({ status: "ok" }));
  registerIngest(app, { store, cache, secret: deps.ingestSecret, defaultUser });

  const now = deps.nowProvider ?? (() => Math.floor(Date.now() / 1000));
  registerStats(app, {
    statsDb: deps.statsDb,
    reader: deps.reader,
    cache,
    now,
    sessionGapSeconds: deps.sessionGapMinutes * 60,
    defaultUser,
  });

  app.decorate("spindle", { store, cache, reader: deps.reader, statsDb: deps.statsDb, sessionGapMinutes: deps.sessionGapMinutes });
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
