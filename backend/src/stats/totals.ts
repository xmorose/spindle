import type { Database } from "better-sqlite3";
import type { PlayAggregate } from "./aggregate.js";
import type { Timeframe } from "./timeframe.js";

export interface Totals {
  plays: number;
  seconds: number;
  distinctTracks: number;
  distinctArtists: number;
  distinctAlbums: number;
  avgPlaysPerActiveDay: number;
}

export function computeTotals(db: Database, agg: PlayAggregate, tf: Timeframe, user: string): Totals {
  const { rows, meta } = agg;

  let plays = 0, seconds = 0;
  const artists = new Set<string>(), albums = new Set<string>(), trackSet = new Set<string>();
  for (const r of rows) {
    const m = meta.get(r.nd_track_id);
    if (!m) continue;
    plays += r.plays;
    seconds += r.plays * m.duration;
    trackSet.add(m.id); artists.add(m.artistId); albums.add(m.albumId);
  }

  const activeDays = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT played_at/86400) AS d FROM counted_plays
         WHERE user=? AND played_at BETWEEN ? AND ? AND source<>'baseline'`,
      )
      .get(user, tf.fromTs, tf.toTs) as { d: number }
  ).d;

  return {
    plays,
    seconds,
    distinctTracks: trackSet.size,
    distinctArtists: artists.size,
    distinctAlbums: albums.size,
    avgPlaysPerActiveDay: activeDays > 0 ? plays / activeDays : 0,
  };
}
