import type { FlowData, FlowGroup, FlowSeries } from "@/api/types";
import { formatNumber } from "@/lib/format";

export type FlowMetric = "plays" | "time";

export const FLOW_W = 1200;
export const FLOW_H = 560;
const PAD_Y = 24;

export const GROUP_LABELS: Record<FlowGroup, string> = { artist: "Artists", album: "Albums", genre: "Genres" };

interface Point { x: number; y: number; }

export interface FlowLayer {
  series: FlowSeries;
  path: string;
  topPath: string;
}

export function formatFlowPlays(n: number): string {
  return `${formatNumber(Math.round(n * 10) / 10)} plays`;
}

export function flowValues(series: FlowSeries, metric: FlowMetric): number[] {
  return metric === "time" ? series.seconds : series.plays;
}

function orderLayers(series: FlowSeries[], metric: FlowMetric): { series: FlowSeries; values: number[] }[] {
  const byPeak = series
    .map((s) => {
      const values = flowValues(s, metric);
      return { series: s, values, peak: values.indexOf(Math.max(...values)) };
    })
    .sort((a, b) => a.peak - b.peak || a.series.id.localeCompare(b.series.id));
  const below: typeof byPeak = [];
  const above: typeof byPeak = [];
  let belowSum = 0;
  let aboveSum = 0;
  for (const entry of byPeak) {
    const total = entry.values.reduce((sum, v) => sum + v, 0);
    if (belowSum <= aboveSum) { below.push(entry); belowSum += total; }
    else { above.push(entry); aboveSum += total; }
  }
  return [...below.reverse(), ...above];
}

function wiggleBaseline(layers: { values: number[] }[], n: number): number[] {
  const baseline = [0];
  for (let j = 1; j < n; j++) {
    let total = 0;
    let weighted = 0;
    let slopeBelow = 0;
    for (const { values } of layers) {
      const slope = values[j] - values[j - 1];
      weighted += (slopeBelow + slope / 2) * values[j];
      total += values[j];
      slopeBelow += slope;
    }
    baseline.push(baseline[j - 1] - (total ? weighted / total : 0));
  }
  return baseline;
}

function curve(points: Point[]): string {
  return points.slice(1).map((b, i) => {
    const a = points[i];
    const mid = (a.x + b.x) / 2;
    return `C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`;
  }).join(" ");
}

export function streamGeometry(data: FlowData, metric: FlowMetric): FlowLayer[] {
  const n = data.starts.length;
  if (!n) return [];
  const ordered = orderLayers(data.series, metric);
  const baseline = wiggleBaseline(ordered, n);
  const stack = baseline.slice();
  const bands = ordered.map(({ series, values }) => {
    const low = stack.slice();
    values.forEach((v, j) => { stack[j] += v; });
    return { series, low, high: stack.slice() };
  });

  const min = Math.min(...baseline);
  const max = Math.max(...stack);
  const scale = (FLOW_H - 2 * PAD_Y) / Math.max(1, max - min);
  const y = (v: number) => FLOW_H - PAD_Y - (v - min) * scale;
  const toPoints = (vs: number[]): Point[] => n === 1
    ? [{ x: 0, y: y(vs[0]) }, { x: FLOW_W, y: y(vs[0]) }]
    : vs.map((v, i) => ({ x: (i * FLOW_W) / (n - 1), y: y(v) }));

  return bands.map(({ series, low, high }) => {
    const upper = toPoints(high);
    const lower = toPoints(low).reverse();
    const topPath = `M${upper[0].x},${upper[0].y} ${curve(upper)}`;
    return { series, topPath, path: `${topPath} L${lower[0].x},${lower[0].y} ${curve(lower)} Z` };
  });
}

export function fallbackFlowColor(id: string): string {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return `oklch(0.72 0.16 ${(hash >>> 0) % 360})`;
}

export function oklchHue(color: string): number {
  return Number(color.match(/([\d.]+)\)$/)?.[1] ?? 0);
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}
