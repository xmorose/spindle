import type { Database } from "better-sqlite3";
import type { NavidromeReader } from "../db/navidrome-db.js";
import type { Timeframe } from "./timeframe.js";

export type Bucketing = "day" | "week" | "month";
export interface SeriesPoint { bucket: number; plays: number; seconds: number; }

const DIVISOR: Record<Bucketing, number> = {
  day: 86400,
  week: 7 * 86400,
  month: 30 * 86400,
};

interface Row { bucket: number; nd_track_id: string; plays: number; }

export function computeTimeseries(
  db: Database,
  reader: NavidromeReader,
  tf: Timeframe,
  user: string,
  bucketing: Bucketing,
): SeriesPoint[] {
  const div = DIVISOR[bucketing];
  const rows = db
    .prepare(
      `SELECT played_at/${div} AS bucket, nd_track_id, COUNT(*) AS plays
       FROM play_events
       WHERE user=? AND source<>'baseline' AND played_at BETWEEN ? AND ?
       GROUP BY bucket, nd_track_id
       ORDER BY bucket ASC`,
    )
    .all(user, tf.fromTs, tf.toTs) as Row[];
  const meta = reader.tracksById([...new Set(rows.map((r) => r.nd_track_id))]);

  const byBucket = new Map<number, SeriesPoint>();
  for (const r of rows) {
    const m = meta.get(r.nd_track_id);
    const cur = byBucket.get(r.bucket) ?? { bucket: r.bucket, plays: 0, seconds: 0 };
    cur.plays += r.plays;
    cur.seconds += r.plays * (m?.duration ?? 0);
    byBucket.set(r.bucket, cur);
  }
  return [...byBucket.values()].sort((a, b) => a.bucket - b.bucket);
}
