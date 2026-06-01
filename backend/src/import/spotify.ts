import { matchKey, normTitle } from "./normalize.js";

export interface SpotifyPlay { ts: string; ms_played: number; track: string | null; artist: string | null; album: string | null; uri: string | null; }
export interface NavTrack { id: string; title: string; artist: string; duration: number; }
export interface ImportEvent { played_at: number; nd_track_id: string; }
export interface Agg { artist: string; title: string; plays: number; }
export interface NavIndex { byKey: Map<string, NavTrack>; byTitle: Map<string, NavTrack[]>; }
export interface ImportReport {
  totalRecords: number;
  nonMusic: number;
  tooShort: number;
  counted: number;
  matched: number;
  matchedExact: number;
  matchedByTitle: number;
  unmatched: number;
  events: ImportEvent[];
  matchedAgg: Agg[];
  byTitleAgg: Agg[];
  unmatchedAgg: Agg[];
  firstTs: number | null;
  lastTs: number | null;
  matchedSeconds: number;
}

function firstArtist(s: string): string { return s.split(",")[0]; }

export function buildIndex(tracks: NavTrack[]): NavIndex {
  const byKey = new Map<string, NavTrack>();
  const byTitle = new Map<string, NavTrack[]>();
  for (const t of tracks) {
    for (const k of new Set([matchKey(t.artist, t.title), matchKey(firstArtist(t.artist), t.title)])) {
      if (!byKey.has(k)) byKey.set(k, t);
    }
    const tk = normTitle(t.title);
    const arr = byTitle.get(tk) ?? [];
    if (!arr.some((x) => x.id === t.id)) arr.push(t);
    byTitle.set(tk, arr);
  }
  return { byKey, byTitle };
}

export function classify(plays: SpotifyPlay[], index: NavIndex, thresholdMs: number): ImportReport {
  const r: ImportReport = { totalRecords: 0, nonMusic: 0, tooShort: 0, counted: 0, matched: 0, matchedExact: 0, matchedByTitle: 0, unmatched: 0,
    events: [], matchedAgg: [], byTitleAgg: [], unmatchedAgg: [], firstTs: null, lastTs: null, matchedSeconds: 0 };
  const matchedMap = new Map<string, Agg>();
  const byTitleMap = new Map<string, Agg>();
  const unmatchedMap = new Map<string, Agg>();

  const bump = (map: Map<string, Agg>, key: string, artist: string, title: string) => {
    const a = map.get(key) ?? { artist, title, plays: 0 };
    a.plays++; map.set(key, a);
  };
  const record = (nav: NavTrack, ts: string) => {
    const at = Math.floor(Date.parse(ts) / 1000);
    r.events.push({ played_at: at, nd_track_id: nav.id });
    r.matchedSeconds += nav.duration;
    if (r.firstTs === null || at < r.firstTs) r.firstTs = at;
    if (r.lastTs === null || at > r.lastTs) r.lastTs = at;
  };

  for (const p of plays) {
    r.totalRecords++;
    if (!p.track || !p.artist) { r.nonMusic++; continue; }
    if (p.ms_played < thresholdMs) { r.tooShort++; continue; }
    r.counted++;
    const key = matchKey(p.artist, p.track);
    const exact = index.byKey.get(key);
    if (exact) {
      r.matched++; r.matchedExact++; record(exact, p.ts);
      bump(matchedMap, key, p.artist, p.track);
      continue;
    }
    const cands = index.byTitle.get(normTitle(p.track));
    if (cands && cands.length === 1) {
      r.matched++; r.matchedByTitle++; record(cands[0], p.ts);
      bump(matchedMap, key, p.artist, p.track);
      bump(byTitleMap, key, p.artist, p.track);
      continue;
    }
    r.unmatched++;
    bump(unmatchedMap, key, p.artist, p.track);
  }

  const desc = (m: Map<string, Agg>) => [...m.values()].sort((a, b) => b.plays - a.plays);
  r.matchedAgg = desc(matchedMap);
  r.byTitleAgg = desc(byTitleMap);
  r.unmatchedAgg = desc(unmatchedMap);
  return r;
}
