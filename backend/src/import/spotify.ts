import { matchKey, normArtist, normTitle } from "./normalize.js";

export interface SpotifyPlay {
  ts: string;
  ms_played: number;
  track: string | null;
  artist: string | null;
  album: string | null;
  uri: string | null;
}

export interface NavTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
}

export interface ImportEvent {
  played_at: number;
  nd_track_id: string;
}

export interface Agg {
  artist: string;
  title: string;
  plays: number;
}

export interface ImportReport {
  totalRecords: number;
  nonMusic: number;
  tooShort: number;
  counted: number;
  matched: number;
  unmatched: number;
  events: ImportEvent[];
  matchedAgg: Agg[];
  unmatchedAgg: Agg[];
  firstTs: number | null;
  lastTs: number | null;
  matchedSeconds: number;
}

function firstArtist(s: string): string {
  return s.split(",")[0];
}

export function buildIndex(tracks: NavTrack[]): Map<string, NavTrack> {
  const m = new Map<string, NavTrack>();
  for (const t of tracks) {
    const keys = new Set([matchKey(t.artist, t.title), matchKey(firstArtist(t.artist), t.title)]);
    for (const k of keys) if (!m.has(k)) m.set(k, t);
  }
  return m;
}

export function classify(
  plays: SpotifyPlay[],
  index: Map<string, NavTrack>,
  thresholdMs: number,
): ImportReport {
  const r: ImportReport = {
    totalRecords: 0,
    nonMusic: 0,
    tooShort: 0,
    counted: 0,
    matched: 0,
    unmatched: 0,
    events: [],
    matchedAgg: [],
    unmatchedAgg: [],
    firstTs: null,
    lastTs: null,
    matchedSeconds: 0,
  };
  const matchedMap = new Map<string, Agg>();
  const unmatchedMap = new Map<string, Agg>();

  for (const p of plays) {
    r.totalRecords++;
    if (!p.track || !p.artist) {
      r.nonMusic++;
      continue;
    }
    if (p.ms_played < thresholdMs) {
      r.tooShort++;
      continue;
    }
    r.counted++;
    const key = matchKey(p.artist, p.track);
    const nav = index.get(key);
    if (nav) {
      r.matched++;
      const at = Math.floor(Date.parse(p.ts) / 1000);
      r.events.push({ played_at: at, nd_track_id: nav.id });
      r.matchedSeconds += nav.duration;
      if (r.firstTs === null || at < r.firstTs) r.firstTs = at;
      if (r.lastTs === null || at > r.lastTs) r.lastTs = at;
      const a = matchedMap.get(key) ?? { artist: p.artist, title: p.track, plays: 0 };
      a.plays++;
      matchedMap.set(key, a);
    } else {
      r.unmatched++;
      const a = unmatchedMap.get(key) ?? { artist: p.artist, title: p.track, plays: 0 };
      a.plays++;
      unmatchedMap.set(key, a);
    }
  }

  r.matchedAgg = [...matchedMap.values()].sort((a, b) => b.plays - a.plays);
  r.unmatchedAgg = [...unmatchedMap.values()].sort((a, b) => b.plays - a.plays);
  return r;
}
