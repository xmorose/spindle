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
