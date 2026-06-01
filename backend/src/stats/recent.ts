import type { Database } from "better-sqlite3";
import type { NavidromeReader } from "../db/navidrome-db.js";

export interface RecentPlay {
  playedAt: number;
  id: string;
  title: string;
  artist: string;
  album: string;
  artistId: string;
  albumId: string;
  hasCoverArt: boolean;
}

interface Row { played_at: number; nd_track_id: string; }

export function recentPlays(db: Database, reader: NavidromeReader, user: string, limit: number): RecentPlay[] {
  const rows = db
    .prepare(
      `SELECT played_at, nd_track_id FROM play_events
       WHERE user=? AND source<>'baseline'
       ORDER BY played_at DESC, id DESC
       LIMIT ?`,
    )
    .all(user, limit) as Row[];
  const meta = reader.tracksById([...new Set(rows.map((r) => r.nd_track_id))]);

  const out: RecentPlay[] = [];
  for (const r of rows) {
    const m = meta.get(r.nd_track_id);
    if (!m) continue;
    out.push({
      playedAt: r.played_at,
      id: m.id, title: m.title, artist: m.artist, album: m.album,
      artistId: m.artistId, albumId: m.albumId, hasCoverArt: m.hasCoverArt,
    });
  }
  return out;
}
