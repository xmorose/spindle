import type { Database } from "better-sqlite3";
import type { NavidromeReader } from "../db/navidrome-db.js";
import type { Timeframe } from "./timeframe.js";
import { topArtists, topAlbums, topTracks } from "./tops.js";

export type EntityKind = "artist" | "album" | "track";

export interface RelatedTrack {
  id: string; title: string; artist: string; artistId: string; plays: number; seconds: number; hasCoverArt: boolean;
}
export interface EntityDetail {
  kind: EntityKind; id: string; name: string; artist?: string; artistId?: string; album?: string;
  plays: number; seconds: number; rank: number;
  firstPlayedAt: number | null; lastPlayedAt: number | null;
  coverArt: string | null;
  history: { day: number; plays: number }[];
  related: RelatedTrack[];
}

interface PlayRow { nd_track_id: string; plays: number; }

// Plays for a specific set of tracks within the window, keyed by track id.
function playsForTracks(db: Database, tf: Timeframe, user: string, ids: string[]): Map<string, number> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const ph = ids.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT nd_track_id, COUNT(*) AS plays FROM play_events
     WHERE user=? AND played_at BETWEEN ? AND ? AND nd_track_id IN (${ph})
     GROUP BY nd_track_id`,
  ).all(user, tf.fromTs, tf.toTs, ...ids) as PlayRow[];
  for (const r of rows) map.set(r.nd_track_id, r.plays);
  return map;
}

function span(db: Database, tf: Timeframe, user: string, ids: string[]): { first: number | null; last: number | null } {
  if (ids.length === 0) return { first: null, last: null };
  const ph = ids.map(() => "?").join(",");
  return db.prepare(
    `SELECT MIN(played_at) AS first, MAX(played_at) AS last FROM play_events
     WHERE user=? AND source<>'baseline' AND played_at BETWEEN ? AND ? AND nd_track_id IN (${ph})`,
  ).get(user, tf.fromTs, tf.toTs, ...ids) as { first: number | null; last: number | null };
}

function dailyHistory(db: Database, tf: Timeframe, user: string, ids: string[]): { day: number; plays: number }[] {
  if (ids.length === 0) return [];
  const ph = ids.map(() => "?").join(",");
  return db.prepare(
    `SELECT played_at/86400 AS day, COUNT(*) AS plays FROM play_events
     WHERE user=? AND source<>'baseline' AND played_at BETWEEN ? AND ? AND nd_track_id IN (${ph})
     GROUP BY day ORDER BY day`,
  ).all(user, tf.fromTs, tf.toTs, ...ids) as { day: number; plays: number }[];
}

export function entityDetail(
  db: Database, reader: NavidromeReader, kind: EntityKind, id: string, tf: Timeframe, user: string,
): EntityDetail | null {
  if (kind === "album" || kind === "artist") return catalogDetail(db, reader, kind, id, tf, user);
  return trackDetail(db, reader, id, tf, user);
}

// Album/artist pages list the entity's *entire* catalog — every track, with its play
// count in the selected window (0 for tracks not played in that range). The listing is
// catalog-wide and timeframe-independent; only the counts move with the range.
function catalogDetail(
  db: Database, reader: NavidromeReader, kind: "album" | "artist", id: string, tf: Timeframe, user: string,
): EntityDetail | null {
  const catalog = kind === "album" ? reader.albumTrackMetas(id) : reader.artistTrackMetas(id);
  if (catalog.length === 0) return null; // entity isn't in the library at all

  const ids = catalog.map((m) => m.id);
  const playMap = playsForTracks(db, tf, user, ids);

  let totalPlays = 0, totalSeconds = 0;
  const related: RelatedTrack[] = catalog.map((m) => {
    const plays = playMap.get(m.id) ?? 0;
    totalPlays += plays;
    totalSeconds += plays * m.duration;
    return { id: m.id, title: m.title, artist: m.artist, artistId: m.artistId, plays, seconds: plays * m.duration, hasCoverArt: m.hasCoverArt };
  });
  // Albums keep their disc/track order; for an artist, most-played first with unplayed sinking to the bottom.
  if (kind === "artist") related.sort((a, b) => b.plays - a.plays);

  const sample = catalog[0];
  const name = kind === "artist" ? sample.artist : sample.album;

  const idx = kind === "artist"
    ? topArtists(db, reader, tf, user, "plays", 100000).findIndex((a) => a.artistId === id)
    : topAlbums(db, reader, tf, user, "plays", 100000).findIndex((a) => a.albumId === id);
  const rank = idx >= 0 ? idx + 1 : 0; // 0 = unranked (no plays in this window)

  const { first, last } = span(db, tf, user, ids);
  return {
    kind, id, name,
    artist: kind === "artist" ? undefined : sample.artist,
    artistId: kind === "artist" ? undefined : sample.artistId,
    album: undefined,
    plays: totalPlays, seconds: totalSeconds, rank,
    firstPlayedAt: first ?? null, lastPlayedAt: last ?? null,
    coverArt: related.find((r) => r.hasCoverArt)?.id ?? null,
    history: dailyHistory(db, tf, user, ids),
    related,
  };
}

function trackDetail(
  db: Database, reader: NavidromeReader, id: string, tf: Timeframe, user: string,
): EntityDetail | null {
  const meta = reader.tracksById([id]).get(id);
  if (!meta) return null; // track isn't in the library at all
  const plays = playsForTracks(db, tf, user, [id]).get(id) ?? 0;

  const idx = plays > 0 ? topTracks(db, reader, tf, user, "plays", 100000).findIndex((t) => t.id === id) : -1;
  const rank = idx >= 0 ? idx + 1 : 0; // 0 = unranked (no plays in this window)

  const { first, last } = span(db, tf, user, [id]);
  return {
    kind: "track", id, name: meta.title,
    artist: meta.artist, artistId: meta.artistId, album: meta.album,
    plays, seconds: plays * meta.duration, rank,
    firstPlayedAt: first ?? null, lastPlayedAt: last ?? null,
    coverArt: meta.hasCoverArt ? meta.id : null,
    history: dailyHistory(db, tf, user, [id]),
    related: [{ id: meta.id, title: meta.title, artist: meta.artist, artistId: meta.artistId, plays, seconds: plays * meta.duration, hasCoverArt: meta.hasCoverArt }],
  };
}
