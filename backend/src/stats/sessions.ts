import type { Database } from "better-sqlite3";
import type { NavidromeReader } from "../db/navidrome-db.js";
import type { Timeframe } from "./timeframe.js";

export interface SessionTrack {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  albumId: string;
  hasCoverArt: boolean;
  duration: number;
  plays: number;
}

export interface Session {
  startedAt: number;
  endedAt: number;
  trackCount: number;
  seconds: number;
  tracks: SessionTrack[];
}

interface Row { played_at: number; nd_track_id: string; }

export function computeSessions(
  db: Database,
  reader: NavidromeReader,
  tf: Timeframe,
  user: string,
  gapSeconds: number,
  limit: number,
  order: "recent" | "longest" = "recent",
): Session[] {
  const rows = db
    .prepare(
      `SELECT played_at, nd_track_id FROM counted_plays
       WHERE user=? AND source<>'baseline' AND played_at BETWEEN ? AND ?
       ORDER BY played_at ASC`,
    )
    .all(user, tf.fromTs, tf.toTs) as Row[];
  const meta = reader.tracksById([...new Set(rows.map((r) => r.nd_track_id))]);

  const sessions: Session[] = [];
  let cur: Session | null = null;
  let lastTs = 0;
  for (const r of rows) {
    const m = meta.get(r.nd_track_id);
    const dur = m?.duration ?? 0;
    if (cur && r.played_at - lastTs <= gapSeconds) {
      cur.endedAt = r.played_at;
      cur.trackCount += 1;
      cur.seconds += dur;
    } else {
      cur = { startedAt: r.played_at, endedAt: r.played_at, trackCount: 1, seconds: dur, tracks: [] };
      sessions.push(cur);
    }
    if (m) {
      const last = cur.tracks[cur.tracks.length - 1];
      if (last && last.id === m.id) last.plays += 1;
      else cur.tracks.push({ id: m.id, title: m.title, artist: m.artist, artistId: m.artistId, albumId: m.albumId, hasCoverArt: m.hasCoverArt, duration: m.duration, plays: 1 });
    }
    lastTs = r.played_at;
  }
  sessions.sort(order === "longest" ? (a, b) => b.seconds - a.seconds : (a, b) => b.startedAt - a.startedAt);
  return sessions.slice(0, limit);
}
