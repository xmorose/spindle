import { api } from "@/api/client";

const WEEKMS = 7 * 86400000;
let promise: Promise<number[]> | null = null;

export function loadYears(): Promise<number[]> {
  return (promise ??= api.timeseries({ range: "all", bucket: "week" }).then((series) => {
    const nowY = new Date().getFullYear();
    if (!series.length) return [nowY];
    const firstY = new Date(series[0].bucket * WEEKMS).getUTCFullYear();
    const out: number[] = [];
    for (let y = nowY; y >= Math.min(firstY, nowY); y--) out.push(y);
    return out;
  }));
}
