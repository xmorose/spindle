import { loadConfig } from "./config.js";
import { openStatsDb } from "./db/stats-db.js";
import { NavidromeReader } from "./db/navidrome-db.js";
import { EventStore } from "./events/store.js";
import { importBaseline } from "./baseline.js";
import { buildApp } from "./app.js";
import type { FastifyInstance } from "fastify";

export async function bootApp(env?: Record<string, string | undefined>): Promise<FastifyInstance> {
  const cfg = loadConfig(env);
  if (!cfg.auth) console.warn("[spindle] AUTH DISABLED — set SPINDLE_PASSWORD_HASH and SESSION_SECRET to require login");
  const statsDb = openStatsDb(cfg.statsDbPath);
  const reader =
    cfg.navidromeDbPath === ":memory:"
      ? NavidromeReader.empty()
      : new NavidromeReader(cfg.navidromeDbPath);

  const store = new EventStore(statsDb);
  importBaseline(statsDb, store, reader);

  return buildApp({
    statsDb,
    reader,
    ingestSecret: cfg.ingestSecret,
    sessionGapMinutes: cfg.sessionGapMinutes,
    defaultUser: cfg.defaultUser,
    auth: cfg.auth,
    cover: cfg.cover,
  });
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const cfg = loadConfig();
  bootApp().then(async (app) => {
    const addr = await app.listen({ port: cfg.port, host: "0.0.0.0" });
    console.log(`Spindle backend listening on ${addr}`);
  });
}
