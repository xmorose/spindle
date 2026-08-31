import { dayKey, monthKeyOfDayKey, yearOfMonthKey } from "@/lib/calendar";

export interface DayStat { plays: number; seconds: number }

export type DailyStats = Map<string, DayStat>;

export type HeatScale = (plays: number) => number;

export interface HeatScaleOptions {
  percentile: number;
  empty: number;
  base: number;
  span: number;
}

function percentileOf(sorted: number[], percentile: number): number {
  if (!sorted.length) return 1;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))];
}

export function createHeatScale(values: Iterable<number>, options: HeatScaleOptions): HeatScale {
  const positive = [...values].filter((v) => v > 0).sort((a, b) => a - b);
  const ceiling = Math.sqrt(Math.max(1, percentileOf(positive, options.percentile)));
  return (plays) => {
    if (plays <= 0) return options.empty;
    return options.base + options.span * Math.min(1, Math.sqrt(plays) / ceiling);
  };
}

export function playsByMonth(daily: DailyStats): Map<string, number> {
  const totals = new Map<string, number>();
  for (const [key, stat] of daily) {
    const month = monthKeyOfDayKey(key);
    totals.set(month, (totals.get(month) ?? 0) + stat.plays);
  }
  return totals;
}

export function playsByYear(monthly: Map<string, number>): Map<number, number> {
  const totals = new Map<number, number>();
  for (const [key, plays] of monthly) {
    const year = yearOfMonthKey(key);
    totals.set(year, (totals.get(year) ?? 0) + plays);
  }
  return totals;
}

export function totalsBetween(daily: DailyStats, from: Date, to: Date): DayStat {
  let plays = 0;
  let seconds = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const stat = daily.get(dayKey(cursor));
    if (stat) {
      plays += stat.plays;
      seconds += stat.seconds;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { plays, seconds };
}
