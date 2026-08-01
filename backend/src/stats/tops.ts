import type { PlayAggregate } from "./aggregate.js";

export type Sort = "plays" | "time";

export interface ArtistTop { artistId: string; name: string; plays: number; seconds: number; coverArt: string | null; }
export interface AlbumTop { albumId: string; name: string; artist: string; artistId: string; plays: number; seconds: number; }
export interface TrackTop { id: string; title: string; artist: string; artistId: string; album: string; plays: number; seconds: number; hasCoverArt: boolean; }
export interface GenreTop { genre: string; plays: number; seconds: number; }

function sortRows<T extends { plays: number; seconds: number }>(rows: T[], sort: Sort, limit: number): T[] {
  const key = sort === "time" ? "seconds" : "plays";
  return rows.sort((a, b) => b[key] - a[key]).slice(0, limit);
}

export function topTracks(agg: PlayAggregate, sort: Sort, limit: number): TrackTop[] {
  const { rows: plays, meta } = agg;
  const rows: TrackTop[] = [];
  for (const p of plays) {
    const m = meta.get(p.nd_track_id);
    if (!m) continue;
    rows.push({ id: m.id, title: m.title, artist: m.artist, artistId: m.artistId, album: m.album, plays: p.plays, seconds: p.plays * m.duration, hasCoverArt: m.hasCoverArt });
  }
  return sortRows(rows, sort, limit);
}

export function topArtists(agg: PlayAggregate, sort: Sort, limit: number): ArtistTop[] {
  const { rows: plays, meta } = agg;
  const acc = new Map<string, ArtistTop & { _coverPlays: number }>();
  for (const p of plays) {
    const m = meta.get(p.nd_track_id);
    if (!m) continue;
    let cur = acc.get(m.artistId);
    if (!cur) { cur = { artistId: m.artistId, name: m.artist, plays: 0, seconds: 0, coverArt: null, _coverPlays: -1 }; acc.set(m.artistId, cur); }
    cur.plays += p.plays;
    cur.seconds += p.plays * m.duration;
    if (m.hasCoverArt && p.plays > cur._coverPlays) { cur._coverPlays = p.plays; cur.coverArt = m.id; }
  }
  return sortRows([...acc.values()], sort, limit).map(({ _coverPlays, ...rest }) => rest);
}

export function topAlbums(agg: PlayAggregate, sort: Sort, limit: number): AlbumTop[] {
  const { rows: plays, meta } = agg;
  const acc = new Map<string, AlbumTop>();
  for (const p of plays) {
    const m = meta.get(p.nd_track_id);
    if (!m) continue;
    const cur = acc.get(m.albumId) ?? { albumId: m.albumId, name: m.album, artist: m.artist, artistId: m.artistId, plays: 0, seconds: 0 };
    cur.plays += p.plays;
    cur.seconds += p.plays * m.duration;
    acc.set(m.albumId, cur);
  }
  return sortRows([...acc.values()], sort, limit);
}

export function topGenres(agg: PlayAggregate, sort: Sort, limit: number): GenreTop[] {
  const { rows: plays, meta } = agg;
  const acc = new Map<string, GenreTop>();
  for (const p of plays) {
    const m = meta.get(p.nd_track_id);
    if (!m || !m.genre) continue;
    const cur = acc.get(m.genre) ?? { genre: m.genre, plays: 0, seconds: 0 };
    cur.plays += p.plays;
    cur.seconds += p.plays * m.duration;
    acc.set(m.genre, cur);
  }
  return sortRows([...acc.values()], sort, limit);
}
