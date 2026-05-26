import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openStatsDb(path: string): DB {
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
      source      TEXT    NOT NULL DEFAULT 'live'  -- 'live' | 'baseline'
    );
    CREATE INDEX IF NOT EXISTS idx_play_events_user_time
      ON play_events (user, played_at);
    CREATE INDEX IF NOT EXISTS idx_play_events_track
      ON play_events (nd_track_id);
  `);
  return db;
}
