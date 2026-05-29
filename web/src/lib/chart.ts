export interface SeriesPaths {
  line: string;
  area: string;
}

export function buildSeriesPaths(values: number[], w: number, h: number, pad = 4): SeriesPaths {
  if (values.length === 0) return { line: "", area: "" };
  const max = Math.max(...values, 1);
  const innerW = w - 2 * pad;
  const innerH = h - 2 * pad;
  const n = values.length;
  const x = (i: number) => (n === 1 ? pad : pad + (i * innerW) / (n - 1));
  const y = (v: number) => pad + innerH - (v / max) * innerH;

  const pts = values.map((v, i) => `${trim(x(i))},${trim(y(v))}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${trim(x(n - 1))},${trim(h)} L${trim(x(0))},${trim(h)} Z`;
  return { line, area };
}

function trim(n: number): number {
  return Math.round(n * 100) / 100;
}
