import type { Database } from "better-sqlite3";
import type { Timeframe } from "./timeframe.js";

export interface HeatCell { weekday: number; hour: number; plays: number; }

export function computeHeatmap(db: Database, tf: Timeframe, user: string): HeatCell[] {
  const rows = db
    .prepare(
      `SELECT CAST(strftime('%w', played_at, 'unixepoch') AS INTEGER) AS weekday,
              CAST(strftime('%H', played_at, 'unixepoch') AS INTEGER) AS hour,
              COUNT(*) AS plays
       FROM play_events
       WHERE user=? AND source='live' AND played_at BETWEEN ? AND ?
       GROUP BY weekday, hour`,
    )
    .all(user, tf.fromTs, tf.toTs) as HeatCell[];
  return rows;
}
