import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface StatsDbOptions {
  excludeBaselineWhenImported?: boolean;
}

export function openStatsDb(path: string, opts: StatsDbOptions = {}): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS play_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      played_at   INTEGER NOT NULL,            -- Unix seconds
      user        TEXT    NOT NULL,
      nd_track_id TEXT    NOT NULL,
      source      TEXT    NOT NULL DEFAULT 'live'  -- 'live' | 'import' | 'baseline'
    );
    CREATE INDEX IF NOT EXISTS idx_play_events_scan
      ON play_events (user, played_at, source, nd_track_id);
    DROP INDEX IF EXISTS idx_play_events_user_time;
    CREATE INDEX IF NOT EXISTS idx_play_events_track
      ON play_events (nd_track_id);
    CREATE INDEX IF NOT EXISTS idx_play_events_dedup
      ON play_events (user, nd_track_id, source, played_at);
    CREATE TABLE IF NOT EXISTS shares (
      token       TEXT PRIMARY KEY,
      kind        TEXT    NOT NULL,        -- 'track' | 'album' | 'queue'
      track_ids   TEXT    NOT NULL,        -- JSON array of nd track ids, in order
      label       TEXT,
      created_at  INTEGER NOT NULL,        -- Unix seconds
      expires_at  INTEGER NOT NULL         -- created_at + 86400
    );
    CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares (expires_at);
  `);

  const filters = [
    `(p.source <> 'import' OR NOT EXISTS (
           SELECT 1 FROM play_events l
           WHERE l.user = p.user AND l.nd_track_id = p.nd_track_id
             AND l.played_at = p.played_at AND l.source = 'live'))`,
  ];
  if (opts.excludeBaselineWhenImported) {
    filters.push(
      `(p.source <> 'baseline' OR NOT EXISTS (
           SELECT 1 FROM play_events i
           WHERE i.user = p.user AND i.nd_track_id = p.nd_track_id
             AND i.source = 'import'))`,
    );
  }
  db.exec(`
    DROP VIEW IF EXISTS counted_plays;
    CREATE VIEW counted_plays AS
      SELECT id, played_at, user, nd_track_id, source
      FROM play_events p
      WHERE ${filters.join("\n        AND ")};
  `);

  return db;
}
