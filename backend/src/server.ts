import { loadConfig } from "./config.js";
import { openStatsDb } from "./db/stats-db.js";
import { NavidromeReader } from "./db/navidrome-db.js";
import { healLegacyIds } from "./db/id-heal.js";
import { EventStore } from "./events/store.js";
import { importBaseline } from "./baseline.js";
import { buildApp } from "./app.js";
import type { FastifyInstance } from "fastify";

export async function bootApp(env?: Record<string, string | undefined>): Promise<FastifyInstance> {
  const cfg = loadConfig(env);
  if (!cfg.auth) console.warn("[spindle] AUTH DISABLED — set SPINDLE_PASSWORD_HASH and SESSION_SECRET to require login");
  if (!cfg.cover) console.warn("[spindle] cover/stream proxy DISABLED — set NAVIDROME_URL/USER/PASSWORD to enable cover art and the in-app player");
  const statsDb = openStatsDb(cfg.statsDbPath);
  const reader =
    cfg.navidromeDbPath === ":memory:"
      ? NavidromeReader.empty()
      : new NavidromeReader(cfg.navidromeDbPath);

  if (reader.idsMigrated()) {
    const backupPath = cfg.statsDbPath === ":memory:" ? null : `${cfg.statsDbPath}.pre-id-migration.bak`;
    const healed = await healLegacyIds(statsDb, reader, backupPath);
    if (healed) {
      console.log(
        `[spindle] navidrome id migration detected: rewrote ${healed.plays} play events and ${healed.shares} shares` +
          (healed.unverified ? `, left ${healed.unverified} ids that no longer exist in the library` : "") +
          (backupPath ? ` (backup: ${backupPath})` : ""),
      );
    }
  }

  const store = new EventStore(statsDb);
  importBaseline(statsDb, store, reader);

  const knownUsers = (statsDb.prepare("SELECT DISTINCT user FROM play_events").all() as { user: string }[]).map((r) => r.user);
  if (knownUsers.length && !knownUsers.includes(cfg.defaultUser)) {
    console.warn(`[spindle] DEFAULT_USER='${cfg.defaultUser}' has no plays — the dashboard will be empty. Users with data: ${knownUsers.join(", ")}. Set DEFAULT_USER to your Navidrome username.`);
  }

  return buildApp({
    statsDb,
    reader,
    ingestSecret: cfg.ingestSecret,
    sessionGapMinutes: cfg.sessionGapMinutes,
    defaultUser: cfg.defaultUser,
    trustProxy: cfg.trustProxy,
    auth: cfg.auth,
    cover: cfg.cover,
    webDir: cfg.webDir,
  });
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const cfg = loadConfig();
  bootApp().then(async (app) => {
    const addr = await app.listen({ port: cfg.port, host: "0.0.0.0" });
    console.log(`Spindle backend listening on ${addr}`);
  });
}
