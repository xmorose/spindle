export interface Timeframe {
  fromTs: number;
  toTs: number;
}

export interface TimeframeQuery {
  range?: string;
  from?: string;
  to?: string;
}

const RANGE_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  year: 365,
  all: null,
};

export function resolveTimeframe(q: TimeframeQuery, nowTs: number): Timeframe {
  if (q.from !== undefined && q.to !== undefined) {
    return { fromTs: Number(q.from), toTs: Number(q.to) };
  }
  const range = q.range ?? "30d";
  const days = range in RANGE_DAYS ? RANGE_DAYS[range] : 30;
  return { fromTs: days === null ? 0 : nowTs - days * 86400, toTs: nowTs };
}
