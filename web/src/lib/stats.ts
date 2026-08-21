import type { HeatCell } from "@/api/types";

export function hourlyFromHeatmap(cells: Pick<HeatCell, "hour" | "plays">[]): number[] {
  const hours = new Array(24).fill(0);
  for (const c of cells) {
    if (c.hour >= 0 && c.hour < 24) hours[c.hour] += c.plays;
  }
  return hours;
}

export function peakHour(hourly: number[]): number {
  let best = 0;
  for (let i = 1; i < hourly.length; i++) if (hourly[i] > hourly[best]) best = i;
  return best;
}

export function heatmapGrid(cells: HeatCell[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const c of cells) {
    if (c.weekday >= 0 && c.weekday < 7 && c.hour >= 0 && c.hour < 24) grid[c.weekday][c.hour] += c.plays;
  }
  return grid;
}

export function weekdayFromHeatmap(cells: HeatCell[]): number[] {
  const days = new Array(7).fill(0);
  for (const c of cells) {
    if (c.weekday >= 0 && c.weekday < 7) days[c.weekday] += c.plays;
  }
  return days;
}

export interface DayPart { key: string; label: string; from: number; to: number; plays: number; share: number }

const PARTS: { key: string; label: string; from: number; to: number }[] = [
  { key: "night", label: "Night", from: 0, to: 5 },
  { key: "morning", label: "Morning", from: 6, to: 11 },
  { key: "afternoon", label: "Afternoon", from: 12, to: 17 },
  { key: "evening", label: "Evening", from: 18, to: 23 },
];

export function dayParts(hourly: number[]): DayPart[] {
  const total = hourly.reduce((a, b) => a + b, 0) || 1;
  return PARTS.map((p) => {
    let plays = 0;
    for (let h = p.from; h <= p.to; h++) plays += hourly[h] ?? 0;
    return { ...p, plays, share: plays / total };
  });
}

export function quietHour(hourly: number[]): number {
  let best = 0;
  for (let i = 1; i < hourly.length; i++) if (hourly[i] < hourly[best]) best = i;
  return best;
}

export interface StreakInfo { current: number; longest: number; activeDays: number; totalDays: number }

export function streaks(values: number[]): StreakInfo {
  let longest = 0;
  let run = 0;
  let activeDays = 0;
  for (const v of values) {
    if (v > 0) { run++; activeDays++; if (run > longest) longest = run; }
    else run = 0;
  }
  let i = values.length - 1;
  if (i >= 0 && values[i] === 0) i--;
  let current = 0;
  while (i >= 0 && values[i] > 0) { current++; i--; }
  return { current, longest, activeDays, totalDays: values.length };
}
