import type { Database } from "better-sqlite3";
import type { NavidromeReader, TrackMeta } from "../db/navidrome-db.js";
import type { Timeframe } from "./timeframe.js";
import type { Bucketing } from "./timeseries.js";

export type FlowGroup = "artist" | "album" | "genre";

export interface FlowSeries {
  id: string;
  name: string;
  subtitle: string;
  coverArt: string | null;
  href: string | null;
  totalPlays: number;
  totalSeconds: number;
  plays: number[];
  seconds: number[];
  other?: boolean;
}

export interface FlowData {
  group: FlowGroup;
  bucket: Bucketing;
  starts: number[];
  ends: number[];
  from: number;
  to: number;
  series: FlowSeries[];
  totalPlays: number;
  totalSeconds: number;
  unassignedPlays: number;
}

export interface FlowOptions {
  user: string;
  group: FlowGroup;
  bucket: Bucketing | "auto";
  sort: "plays" | "time";
  limit: number;
  offset?: number;
  compact?: boolean;
  focus?: string;
}

interface GroupSpec {
  plural: string;
  unknown: string;
  key: (track: TrackMeta) => string | undefined;
  name: (track: TrackMeta) => string | undefined;
  subtitle: (track: TrackMeta) => string;
  href: ((id: string) => string) | null;
}

const GROUPS: Record<FlowGroup, GroupSpec> = {
  artist: {
    plural: "artists",
    unknown: "Unavailable in library",
    key: (t) => t.artistId,
    name: (t) => t.artistName,
    subtitle: () => "",
    href: (id) => `/artists/${encodeURIComponent(id)}`,
  },
  album: {
    plural: "albums",
    unknown: "Unavailable in library",
    key: (t) => t.albumId,
    name: (t) => t.album,
    subtitle: (t) => t.artistName,
    href: (id) => `/albums/${encodeURIComponent(id)}`,
  },
  genre: {
    plural: "genres",
    unknown: "Untagged",
    key: (t) => t.genre?.trim().toLowerCase(),
    name: (t) => t.genre?.trim(),
    subtitle: () => "",
    href: null,
  },
};

const DAY = 86400;
const UNKNOWN_ID = "__unknown";
const OTHER_ID = "__other";

export function flowBucketStart(timestamp: number, bucket: Bucketing, offset: number): number {
  const date = new Date((timestamp + offset) * 1000);
  date.setUTCHours(0, 0, 0, 0);
  if (bucket === "month") date.setUTCDate(1);
  if (bucket === "week") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.getTime() / 1000 - offset;
}

export function nextFlowBucket(timestamp: number, bucket: Bucketing, offset: number): number {
  if (bucket === "day") return timestamp + DAY;
  if (bucket === "week") return timestamp + 7 * DAY;
  const date = new Date((timestamp + offset) * 1000);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.getTime() / 1000 - offset;
}

function chooseBucket(requested: Bucketing | "auto", days: number, compact: boolean): Bucketing {
  const maxPoints = compact ? 100 : 320;
  const fits = (bucket: Bucketing) => bucket === "month" || days / (bucket === "week" ? 7 : 1) <= maxPoints;
  if (requested === "auto" && days <= (compact ? 45 : 100)) return "day";
  const order: Bucketing[] = ["day", "week", "month"];
  const start = requested === "auto" ? 1 : order.indexOf(requested);
  return order.slice(start).find(fits)!;
}

interface Row { day: number; nd_track_id: string; plays: number; }

interface Point { plays: number; seconds: number; }

interface Aggregate {
  series: Omit<FlowSeries, "plays" | "seconds">;
  points: Map<number, Point>;
  covers: Map<string, number>;
}

function topCover(covers: Map<string, number>): string | null {
  let best: [string, number] | null = null;
  for (const entry of covers) {
    if (!best || entry[1] > best[1] || (entry[1] === best[1] && entry[0] < best[0])) best = entry;
  }
  return best?.[0] ?? null;
}

export function computeFlow(db: Database, reader: NavidromeReader, timeframe: Timeframe, opts: FlowOptions): FlowData {
  const { user, group, sort, limit, offset = 0, compact = false, focus } = opts;
  const spec = GROUPS[group];
  const { first } = db.prepare(`SELECT MIN(played_at) AS first FROM counted_plays
    WHERE user=? AND source<>'baseline' AND played_at BETWEEN ? AND ?`)
    .get(user, timeframe.fromTs, timeframe.toTs) as { first: number | null };
  const from = timeframe.fromTs === 0 ? (first ?? timeframe.toTs) : timeframe.fromTs;
  const to = timeframe.toTs;
  const bucket = chooseBucket(opts.bucket, Math.max(1, (to - from) / DAY), compact);
  const result: FlowData = {
    group, bucket, starts: [], ends: [], from, to, series: [], totalPlays: 0, totalSeconds: 0, unassignedPlays: 0,
  };
  if (first === null) return result;

  for (let at = flowBucketStart(from, bucket, offset); at <= to; at = nextFlowBucket(at, bucket, offset)) {
    result.starts.push(at);
    result.ends.push(nextFlowBucket(at, bucket, offset) - 1);
  }

  const rows = db.prepare(`SELECT CAST((played_at + ?) / 86400 AS INTEGER) AS day, nd_track_id, COUNT(*) AS plays
    FROM counted_plays WHERE user=? AND source<>'baseline' AND played_at BETWEEN ? AND ?
    GROUP BY day, nd_track_id`).all(offset, user, from, to) as Row[];
  const meta = reader.tracksById([...new Set(rows.map((r) => r.nd_track_id))]);
  const groups = new Map<string, Aggregate>();

  const items: { row: Row; artist?: { id: string; name: string }; extra: boolean }[] = [];
  for (const row of rows) {
    const credited = group === "artist" ? meta.get(row.nd_track_id)?.artists ?? [] : [];
    if (credited.length === 0) { items.push({ row, extra: false }); continue; }
    credited.forEach((artist, i) => items.push({ row, artist, extra: i > 0 }));
  }

  for (const { row, artist, extra } of items) {
    const track = meta.get(row.nd_track_id);
    const seconds = row.plays * Math.max(0, track?.duration ?? 0);
    const key = artist ? artist.id : track && spec.key(track);
    const id = key || UNKNOWN_ID;
    if (!extra) {
      result.totalPlays += row.plays;
      result.totalSeconds += seconds;
      if (!key) result.unassignedPlays += row.plays;
    }

    let agg = groups.get(id);
    if (!agg) {
      agg = {
        series: {
          id,
          name: (artist ? artist.name : track && spec.name(track)) || spec.unknown,
          subtitle: track ? spec.subtitle(track) : "",
          coverArt: null,
          href: key && spec.href ? spec.href(key) : null,
          totalPlays: 0,
          totalSeconds: 0,
        },
        points: new Map(),
        covers: new Map(),
      };
      groups.set(id, agg);
    }
    const at = flowBucketStart(row.day * DAY - offset, bucket, offset);
    const point = agg.points.get(at) ?? { plays: 0, seconds: 0 };
    point.plays += row.plays;
    point.seconds += seconds;
    agg.points.set(at, point);
    agg.series.totalPlays += row.plays;
    agg.series.totalSeconds += seconds;
    if (track?.hasCoverArt) agg.covers.set(track.id, (agg.covers.get(track.id) ?? 0) + row.plays);
  }

  const weight = (a: Aggregate) => sort === "time" ? a.series.totalSeconds : a.series.totalPlays;
  const ranked = [...groups.values()].sort((a, b) => weight(b) - weight(a) || a.series.id.localeCompare(b.series.id));
  const selected = ranked.slice(0, limit);
  const pinned = focus ? groups.get(focus) : undefined;
  if (pinned && !selected.includes(pinned)) selected[selected.length - 1] = pinned;

  const valuesAt = (points: Map<number, Point>, field: keyof Point) => result.starts.map((at) => points.get(at)?.[field] ?? 0);
  result.series = selected.map((agg) => ({
    ...agg.series,
    coverArt: topCover(agg.covers),
    plays: valuesAt(agg.points, "plays"),
    seconds: valuesAt(agg.points, "seconds"),
  }));

  const rest = ranked.filter((agg) => !selected.includes(agg));
  if (rest.length) {
    const other: FlowSeries = {
      id: OTHER_ID,
      name: "Other",
      subtitle: `${rest.length} more ${spec.plural}`,
      coverArt: null,
      href: null,
      totalPlays: 0,
      totalSeconds: 0,
      plays: result.starts.map(() => 0),
      seconds: result.starts.map(() => 0),
      other: true,
    };
    for (const agg of rest) {
      other.totalPlays += agg.series.totalPlays;
      other.totalSeconds += agg.series.totalSeconds;
      result.starts.forEach((at, i) => {
        other.plays[i] += agg.points.get(at)?.plays ?? 0;
        other.seconds[i] += agg.points.get(at)?.seconds ?? 0;
      });
    }
    result.series.push(other);
  }
  return result;
}
