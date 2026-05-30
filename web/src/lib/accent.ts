export interface Oklch { l: number; c: number; h: number; }

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

export function rgbToOklch(r: number, g: number, b: number): Oklch {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: C, h };
}

export function clampAccent(o: Oklch): Oklch {
  return {
    l: Math.min(0.82, Math.max(0.6, o.l)),
    c: Math.min(0.18, Math.max(0.08, o.c)),
    h: o.h,
  };
}

function round(n: number, d = 3): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function accentFromRgb(r: number, g: number, b: number): string {
  const a = clampAccent(rgbToOklch(r, g, b));
  return `oklch(${round(a.l)} ${round(a.c)} ${round(a.h, 1)})`;
}

export interface ImageDataLike { data: ArrayLike<number>; width: number; height: number; }

export function dominantColor(img: ImageDataLike): { r: number; g: number; b: number } {
  let wr = 0, wg = 0, wb = 0, wsum = 0;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], alpha = d[i + 3];
    if (alpha < 128) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    const weight = 0.15 + sat;
    wr += r * weight; wg += g * weight; wb += b * weight; wsum += weight;
  }
  if (wsum === 0) return { r: 128, g: 128, b: 128 };
  return { r: Math.round(wr / wsum), g: Math.round(wg / wsum), b: Math.round(wb / wsum) };
}

export function applyAccent(el: HTMLElement, accent: string): void {
  el.style.setProperty("--accent", accent);
}
