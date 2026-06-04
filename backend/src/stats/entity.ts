import type { Database } from "better-sqlite3";
import type { NavidromeReader, TrackMeta } from "../db/navidrome-db.js";
import type { Timeframe } from "./timeframe.js";
import { topArtists, topAlbums, topTracks } from "./tops.js";

export type EntityKind = "artist" | "album" | "track";

export interface RelatedTrack {
  id: string; title: string; artist: string; plays: number; seconds: number; hasCoverArt: boolean;
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

function playsByTrack(db: Database, tf: Timeframe, user: string): PlayRow[] {
  return db.prepare(
    `SELECT nd_track_id, COUNT(*) AS plays FROM play_events
     WHERE user=? AND played_at BETWEEN ? AND ? GROUP BY nd_track_id`,
  ).all(user, tf.fromTs, tf.toTs) as PlayRow[];
}

function matches(kind: EntityKind, m: TrackMeta, id: string): boolean {
  if (kind === "artist") return m.artistId === id;
  if (kind === "album") return m.albumId === id;
  return m.id === id;
}

export function entityDetail(
  db: Database, reader: NavidromeReader, kind: EntityKind, id: string, tf: Timeframe, user: string,
): EntityDetail | null {
  const plays = playsByTrack(db, tf, user);
  const meta = reader.tracksById(plays.map((p) => p.nd_track_id));

  const matched: { meta: TrackMeta; plays: number }[] = [];
  for (const p of plays) {
    const m = meta.get(p.nd_track_id);
    if (m && matches(kind, m, id)) matched.push({ meta: m, plays: p.plays });
  }
  if (matched.length === 0) return null;

  let totalPlays = 0, totalSeconds = 0;
  const related: RelatedTrack[] = [];
  for (const { meta: m, plays: pl } of matched) {
    totalPlays += pl;
    totalSeconds += pl * m.duration;
    related.push({ id: m.id, title: m.title, artist: m.artist, plays: pl, seconds: pl * m.duration, hasCoverArt: m.hasCoverArt });
  }
  related.sort((a, b) => b.plays - a.plays);

  const sample = matched[0].meta;
  const name = kind === "artist" ? sample.artist : kind === "album" ? sample.album : sample.title;

  let idx: number;
  if (kind === "artist") idx = topArtists(db, reader, tf, user, "plays", 100000).findIndex((a) => a.artistId === id);
  else if (kind === "album") idx = topAlbums(db, reader, tf, user, "plays", 100000).findIndex((a) => a.albumId === id);
  else idx = topTracks(db, reader, tf, user, "plays", 100000).findIndex((t) => t.id === id);
  const rank = idx >= 0 ? idx + 1 : matched.length;

  const ids = matched.map((x) => x.meta.id);
  const ph = ids.map(() => "?").join(",");
  const span = db.prepare(
    `SELECT MIN(played_at) AS first, MAX(played_at) AS last FROM play_events
     WHERE user=? AND source<>'baseline' AND played_at BETWEEN ? AND ? AND nd_track_id IN (${ph})`,
  ).get(user, tf.fromTs, tf.toTs, ...ids) as { first: number | null; last: number | null };
  const history = db.prepare(
    `SELECT played_at/86400 AS day, COUNT(*) AS plays FROM play_events
     WHERE user=? AND source<>'baseline' AND played_at BETWEEN ? AND ? AND nd_track_id IN (${ph})
     GROUP BY day ORDER BY day`,
  ).all(user, tf.fromTs, tf.toTs, ...ids) as { day: number; plays: number }[];

  return {
    kind, id, name,
    artist: kind === "artist" ? undefined : sample.artist,
    artistId: kind === "artist" ? undefined : sample.artistId,
    album: kind === "track" ? sample.album : undefined,
    plays: totalPlays, seconds: totalSeconds, rank,
    firstPlayedAt: span.first ?? null, lastPlayedAt: span.last ?? null,
    coverArt: related.find((r) => r.hasCoverArt)?.id ?? null,
    history, related: related.slice(0, 25),
  };
}
