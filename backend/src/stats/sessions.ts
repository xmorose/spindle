import type { Database } from "better-sqlite3";
import type { NavidromeReader } from "../db/navidrome-db.js";
import type { Timeframe } from "./timeframe.js";

export interface Session {
  startedAt: number;
  endedAt: number;
  trackCount: number;
  seconds: number;
}

interface Row { played_at: number; nd_track_id: string; }

export function longestSessions(
  db: Database,
  reader: NavidromeReader,
  tf: Timeframe,
  user: string,
  gapSeconds: number,
  limit: number,
): Session[] {
  const rows = db
    .prepare(
      `SELECT played_at, nd_track_id FROM play_events
       WHERE user=? AND source='live' AND played_at BETWEEN ? AND ?
       ORDER BY played_at ASC`,
    )
    .all(user, tf.fromTs, tf.toTs) as Row[];
  const meta = reader.tracksById([...new Set(rows.map((r) => r.nd_track_id))]);

  const sessions: Session[] = [];
  let cur: Session | null = null;
  let lastTs = 0;
  for (const r of rows) {
    const dur = meta.get(r.nd_track_id)?.duration ?? 0;
    if (cur && r.played_at - lastTs <= gapSeconds) {
      cur.endedAt = r.played_at;
      cur.trackCount += 1;
      cur.seconds += dur;
    } else {
      cur = { startedAt: r.played_at, endedAt: r.played_at, trackCount: 1, seconds: dur };
      sessions.push(cur);
    }
    lastTs = r.played_at;
  }
  return sessions.sort((a, b) => b.seconds - a.seconds).slice(0, limit);
}
