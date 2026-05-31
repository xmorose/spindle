<script setup lang="ts">
import { computed, ref } from "vue";
import { buildSeriesPaths } from "@/lib/chart";

const props = withDefaults(defineProps<{ values: number[]; height?: number }>(), { height: 160 });
const W = 900;
const PAD = 6;
const paths = computed(() => buildSeriesPaths(props.values, W, props.height, PAD));
const max = computed(() => Math.max(...props.values, 1));
const points = computed(() => {
  const n = props.values.length;
  const inner = props.height - 2 * PAD;
  return props.values.map((v, i) => ({
    x: n <= 1 ? PAD : PAD + (i * (W - 2 * PAD)) / (n - 1),
    y: PAD + inner - (v / max.value) * inner,
  }));
});

const hover = ref<number | null>(null);
function onMove(e: PointerEvent) {
  const n = props.values.length;
  if (!n) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  hover.value = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
}
const hx = computed(() => (hover.value === null ? 0 : points.value[hover.value].x));
const leftPct = computed(() => (hover.value === null ? 0 : (hx.value / W) * 100));
const topPct = computed(() => (hover.value === null ? 0 : (points.value[hover.value].y / props.height) * 100));
</script>

<template>
  <div class="relative" @pointermove="onMove" @pointerleave="hover = null">
    <svg :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" class="block w-full" :style="{ height: height + 'px' }">
      <defs>
        <linearGradient id="la-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--accent)" stop-opacity="0.28" />
          <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line :x1="0" :y1="height - PAD" :x2="W" :y2="height - PAD" stroke="var(--color-line)" stroke-width="1" />
      <template v-if="values.length">
        <path :d="paths.area" fill="url(#la-fill)" />
        <path :d="paths.line" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        <line v-if="hover !== null" :x1="hx" :y1="PAD" :x2="hx" :y2="height - PAD" stroke="var(--color-faint)" stroke-width="1" vector-effect="non-scaling-stroke" />
      </template>
    </svg>

    <template v-if="hover !== null && values.length">
      <div class="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        :style="{ left: leftPct + '%', top: topPct + '%', background: 'var(--accent)', boxShadow: '0 0 0 3px var(--color-bg)' }" />
      <div class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[140%] whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-bold tabular shadow-lg"
        :style="{ left: leftPct + '%', top: topPct + '%' }">
        {{ values[hover] }} plays
      </div>
    </template>
  </div>
</template>
