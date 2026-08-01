import type { Database } from "better-sqlite3";
import type { NavidromeReader, TrackMeta } from "../db/navidrome-db.js";
import type { Timeframe } from "./timeframe.js";

export interface PlayRow { nd_track_id: string; plays: number; }
export interface PlayAggregate { rows: PlayRow[]; meta: Map<string, TrackMeta>; }

export function buildPlayAggregate(db: Database, reader: NavidromeReader, tf: Timeframe, user: string): PlayAggregate {
  const rows = db
    .prepare(
      `SELECT nd_track_id, COUNT(*) AS plays
       FROM play_events
       WHERE user=? AND played_at BETWEEN ? AND ?
       GROUP BY nd_track_id`,
    )
    .all(user, tf.fromTs, tf.toTs) as PlayRow[];
  return { rows, meta: reader.tracksById(rows.map((r) => r.nd_track_id)) };
}
