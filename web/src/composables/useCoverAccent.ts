import { watch } from "vue";
import { paletteFromImage, applyPalette } from "@/lib/accent";
import { coverUrl } from "@/api/client";

const BRAND_FALLBACK = ["oklch(0.76 0.15 50)", "oklch(0.72 0.14 22)", "oklch(0.74 0.13 82)"];

export function useCoverAccent(
  coverId: () => string | null | undefined,
  urlFor: (id: string) => string = (id) => coverUrl(id, 64),
): void {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (!root) return;

  function reset() { applyPalette(root!, BRAND_FALLBACK); }

  watch(coverId, (id) => {
    if (!id) { reset(); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 40;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reset();
        ctx.drawImage(img, 0, 0, size, size);
        const { data, width, height } = ctx.getImageData(0, 0, size, size);
        applyPalette(root!, paletteFromImage({ data, width, height }, 3));
      } catch {
        reset();
      }
    };
    img.onerror = reset;
    img.src = urlFor(id);
  }, { immediate: true });
}
