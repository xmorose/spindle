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

export interface ImageDataLike { data: ArrayLike<number>; width: number; height: number; }

const HUE_BUCKETS = 24;
const BUCKET_DEG = 360 / HUE_BUCKETS;

interface Bucket { weight: number; l: number; c: number; h: number; }

export function paletteFromImage(img: ImageDataLike, count = 3): string[] {
  const buckets: Bucket[] = Array.from({ length: HUE_BUCKETS }, () => ({ weight: 0, l: 0, c: 0, h: 0 }));
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const o = rgbToOklch(d[i], d[i + 1], d[i + 2]);
    if (o.c < 0.03 || o.l < 0.12 || o.l > 0.95) continue;
    const b = buckets[Math.min(HUE_BUCKETS - 1, Math.floor(o.h / BUCKET_DEG))];
    const w = o.c;
    b.weight += w; b.l += o.l * w; b.c += o.c * w; b.h += o.h * w;
  }

  const ranked = buckets
    .filter((b) => b.weight > 0)
    .map((b) => ({ weight: b.weight, l: b.l / b.weight, c: b.c / b.weight, h: b.h / b.weight }))
    .sort((a, b) => b.weight - a.weight);

  const picked: Oklch[] = [];
  for (const b of ranked) {
    if (picked.length >= count) break;
    const tooClose = picked.some((p) => {
      const diff = Math.abs(p.h - b.h);
      return Math.min(diff, 360 - diff) < 40;
    });
    if (!tooClose) picked.push({ l: b.l, c: b.c, h: b.h });
  }

  const seed = picked[0] ?? (ranked[0] ? { l: ranked[0].l, c: ranked[0].c, h: ranked[0].h } : { l: 0.76, c: 0.15, h: 50 });
  while (picked.length < count) {
    picked.push({ l: seed.l, c: seed.c, h: (seed.h + picked.length * 32) % 360 });
  }

  return picked.map((p) => {
    const a = clampAccent(p);
    return `oklch(${round(a.l)} ${round(a.c)} ${round(a.h, 1)})`;
  });
}

export function applyPalette(el: HTMLElement, palette: string[]): void {
  el.style.setProperty("--accent", palette[0]);
  el.style.setProperty("--accent-2", palette[1] ?? palette[0]);
  el.style.setProperty("--accent-3", palette[2] ?? palette[1] ?? palette[0]);
}
