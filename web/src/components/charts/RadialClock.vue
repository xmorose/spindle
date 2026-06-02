<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{ hours: number[] }>();
const CX = 100, CY = 100, INNER = 40, MAXLEN = 52;
const max = computed(() => Math.max(...props.hours, 1));

function lenFor(v: number) { return 4 + (v / max.value) * MAXLEN; }

const spokes = computed(() =>
  props.hours.map((v, h) => {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    const len = lenFor(v);
    const cos = Math.cos(a), sin = Math.sin(a);
    return {
      x1: CX + cos * INNER, y1: CY + sin * INNER,
      x2: CX + cos * (INNER + len), y2: CY + sin * (INNER + len),
      opacity: (0.28 + 0.72 * (v / max.value)).toFixed(2),
    };
  }),
);
const labels = [0, 6, 12, 18].map((hh, i) => {
  const a = ((i * 6) / 24) * 2 * Math.PI - Math.PI / 2;
  const r = INNER + MAXLEN + 13;
  return { t: String(hh).padStart(2, "0"), x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r + 3 };
});

const hover = ref<number | null>(null);
function onMove(e: PointerEvent) {
  const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 200;
  const y = ((e.clientY - rect.top) / rect.height) * 200;
  const dx = x - CX, dy = y - CY;
  const dist = Math.hypot(dx, dy);
  if (dist < INNER - 8 || dist > INNER + MAXLEN + 16) { hover.value = null; return; }
  let a = Math.atan2(dy, dx) + Math.PI / 2;
  if (a < 0) a += 2 * Math.PI;
  hover.value = Math.round((a / (2 * Math.PI)) * 24) % 24;
}
const tip = computed(() => {
  if (hover.value === null) return null;
  const h = hover.value;
  const v = props.hours[h] ?? 0;
  const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
  const r = INNER + lenFor(v) + 7;
  return { h, v, leftPct: ((CX + Math.cos(a) * r) / 200) * 100, topPct: ((CY + Math.sin(a) * r) / 200) * 100 };
});
</script>

<template>
  <div class="relative">
    <svg viewBox="0 0 200 200" class="block" @pointermove="onMove" @pointerleave="hover = null">
      <circle :cx="CX" :cy="CY" :r="INNER - 4" fill="none" stroke="var(--color-line)" stroke-width="1" />
      <circle class="spindle" :cx="CX" :cy="CY" r="3.5" fill="var(--accent)" />
      <line v-for="(s, i) in spokes" :key="i" class="spoke" pathLength="1"
        :style="{ animationDelay: (i * 0.018) + 's' }"
        :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2"
        stroke="var(--accent)" :stroke-opacity="i === hover ? 1 : s.opacity"
        :stroke-width="i === hover ? 6 : 4.5" stroke-linecap="round" />
      <text v-for="(l, i) in labels" :key="i" :x="l.x" :y="l.y"
        fill="var(--color-faint)" font-size="9" font-weight="700" text-anchor="middle">{{ l.t }}</text>
    </svg>

    <div v-if="tip" class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-1 text-center shadow-lg"
      :style="{ left: tip.leftPct + '%', top: tip.topPct + '%' }">
      <div class="tabular text-xs font-bold">{{ String(tip.h).padStart(2, '0') }}:00</div>
      <div class="tabular text-[10px] text-faint">{{ tip.v }} {{ tip.v === 1 ? 'play' : 'plays' }}</div>
    </div>
  </div>
</template>

<style scoped>
.spoke { stroke-dasharray: 1; animation: spoke-draw 0.5s var(--ease-out-quint) both; }
@keyframes spoke-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .spoke { animation: none; } }
</style>
