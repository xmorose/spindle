import { matchKey, normTitle, normArtist, fuzzyTitleKey } from "./normalize.js";

export interface NavTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
}

export interface LastFmPlay {
  ts: string;
  ms_played: number;
  track: string | null;
  artist: string | null;
  album: string | null;
  uri: string | null;
}

export interface ImportEvent {
  played_at: number;
  nd_track_id: string;
}

export interface UnmatchedTrack {
  artist: string;
  title: string;
  plays: number;
}

export interface ClassifyReport {
  counted: number;
  matched: number;
  matchedExact: number;
  matchedByTitle: number;
  unmatched: number;
  events: ImportEvent[];
  unmatchedAgg: UnmatchedTrack[];
}

export interface TrackIndex {
  byKey: Map<string, NavTrack>;
  byTitle: Map<string, NavTrack[]>;
  byFuzzyTitle: Map<string, NavTrack[]>;
}


function firstArtist(s: string): string {
  return s.split(",")[0];
}


function addTitle(
  map: Map<string, NavTrack[]>,
  key: string,
  track: NavTrack
): void {
  const arr = map.get(key) ?? [];

  if (!arr.some((x) => x.id === track.id)) {
    arr.push(track);
  }

  map.set(key, arr);
}


export function buildIndex(tracks: NavTrack[]): TrackIndex {
  const byKey = new Map<string, NavTrack>();
  const byTitle = new Map<string, NavTrack[]>();
  const byFuzzyTitle = new Map<string, NavTrack[]>();

  for (const t of tracks) {
    const artists = new Set(
      t.artist
        .split(/[•,;]+/)
        .map((a) => normArtist(a))
        .filter(Boolean)
    );

    const nt = normTitle(t.title);

    addTitle(byTitle, nt, t);
    addTitle(byFuzzyTitle, fuzzyTitleKey(t.title), t);

    for (const a of artists) {
      const key = `${a} ${nt}`;

      if (!byKey.has(key)) {
        byKey.set(key, t);
      }
    }
  }

  for (const t of tracks) {
    const nt = normTitle(t.title);

    if (nt && !byKey.has(nt)) {
      byKey.set(nt, t);
    }
  }

  return {
    byKey,
    byTitle,
    byFuzzyTitle
  };
}


export function matchOne(
  index: TrackIndex,
  artist: string,
  title: string
): NavTrack | null {

  const exact = index.byKey.get(
    matchKey(artist, title)
  );

  if (exact) {
    return exact;
  }

  const titleMatches = index.byTitle.get(
    normTitle(title)
  );

  if (titleMatches && titleMatches.length === 1) {
    return titleMatches[0];
  }

  const fuzzyMatches = index.byFuzzyTitle.get(
    fuzzyTitleKey(title)
  );

  if (fuzzyMatches && fuzzyMatches.length > 0) {
    const artistMatch = fuzzyMatches.find(
      (t) =>
        normArtist(t.artist) === normArtist(artist)
    );

    if (artistMatch) {
      return artistMatch;
    }

    if (fuzzyMatches.length === 1) {
      return fuzzyMatches[0];
    }
  }

  return null;
}


export function classify(
  plays: LastFmPlay[],
  index: TrackIndex,
  thresholdMs: number
): ClassifyReport {

  const report: ClassifyReport = {
    counted: 0,
    matched: 0,
    matchedExact: 0,
    matchedByTitle: 0,
    unmatched: 0,
    events: [],
    unmatchedAgg: []
  };

  const unmatchedMap = new Map<string, UnmatchedTrack>();

  for (const p of plays) {

    if (!p.track || !p.artist) {
      continue;
    }

    if (p.ms_played < thresholdMs) {
      continue;
    }

    report.counted++;

    const exact = index.byKey.get(
      matchKey(p.artist, p.track)
    );

    if (exact) {
      report.matched++;
      report.matchedExact++;

      report.events.push({
        played_at: Math.floor(Date.parse(p.ts) / 1000),
        nd_track_id: exact.id
      });

      continue;
    }


    const titleMatches = index.byTitle.get(
      normTitle(p.track)
    );

    if (titleMatches && titleMatches.length === 1) {
      report.matched++;
      report.matchedByTitle++;

      report.events.push({
        played_at: Math.floor(Date.parse(p.ts) / 1000),
        nd_track_id: titleMatches[0].id
      });

      continue;
    }


    const fuzzyMatches = index.byFuzzyTitle.get(
      fuzzyTitleKey(p.track)
    );


    if (fuzzyMatches && fuzzyMatches.length > 0) {

      const artistMatch = fuzzyMatches.find(
        (t) =>
          normArtist(t.artist) === normArtist(p.artist)
      );

      const matchedTrack =
        artistMatch ??
        (fuzzyMatches.length === 1
          ? fuzzyMatches[0]
          : null);


      if (matchedTrack) {
        report.matched++;
        report.matchedByTitle++;

        report.events.push({
          played_at: Math.floor(Date.parse(p.ts) / 1000),
          nd_track_id: matchedTrack.id
        });

        continue;
      }
    }


    report.unmatched++;

    const key = `${p.artist}\u0000${p.track}`;

    const old = unmatchedMap.get(key) ?? {
      artist: p.artist,
      title: p.track,
      plays: 0
    };

    old.plays++;

    unmatchedMap.set(key, old);
  }


  report.unmatchedAgg = [
    ...unmatchedMap.values()
  ].sort((a, b) => b.plays - a.plays);


  return report;
}
