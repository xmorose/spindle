<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { buildSeriesPaths } from "@/lib/chart";

const props = withDefaults(
  defineProps<{ values: number[]; height?: number; labels?: string[]; zoomable?: boolean }>(),
  { height: 160 },
);
const W = 900;
const PAD = 6;

const box = ref<HTMLElement | null>(null);
const win = ref({ s: 0, e: props.values.length });
watch(() => props.values.length, (n) => { win.value = { s: 0, e: n }; });

const drawKey = ref(0);
watch(() => props.values, () => { drawKey.value++; });

const visible = computed(() => (props.zoomable ? props.values.slice(win.value.s, win.value.e) : props.values));
const visibleLabels = computed(() =>
  props.labels ? (props.zoomable ? props.labels.slice(win.value.s, win.value.e) : props.labels) : undefined,
);
const zoomed = computed(() => props.zoomable && (win.value.s > 0 || win.value.e < props.values.length));

const paths = computed(() => buildSeriesPaths(visible.value, W, props.height, PAD));
const max = computed(() => Math.max(...visible.value, 1));
const points = computed(() => {
  const n = visible.value.length;
  const inner = props.height - 2 * PAD;
  return visible.value.map((v, i) => ({
    x: n <= 1 ? PAD : PAD + (i * (W - 2 * PAD)) / (n - 1),
    y: PAD + inner - (v / max.value) * inner,
  }));
});

function reset() { win.value = { s: 0, e: props.values.length }; }

function onWheel(e: WheelEvent) {
  if (!props.zoomable || !box.value) return;
  e.preventDefault();
  const n = props.values.length;
  const span = win.value.e - win.value.s;
  const rect = box.value.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const center = win.value.s + ratio * span;
  const newSpan = Math.max(4, Math.min(n, Math.round(span * (e.deltaY < 0 ? 0.8 : 1.25))));
  const s = Math.max(0, Math.min(n - newSpan, Math.round(center - ratio * newSpan)));
  win.value = { s, e: s + newSpan };
}

const hover = ref<number | null>(null);
let pan: { x: number; s: number; e: number } | null = null;
function onDown(e: PointerEvent) {
  if (!props.zoomable || !box.value) return;
  pan = { x: e.clientX, s: win.value.s, e: win.value.e };
  box.value.setPointerCapture(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (pan && box.value) {
    const span = pan.e - pan.s;
    const rect = box.value.getBoundingClientRect();
    const dxIdx = ((e.clientX - pan.x) / rect.width) * span;
    const s = Math.max(0, Math.min(props.values.length - span, Math.round(pan.s - dxIdx)));
    win.value = { s, e: s + span };
    hover.value = null;
    return;
  }
  const n = visible.value.length;
  if (!n) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  hover.value = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
}
function onUp() { pan = null; }

const hx = computed(() => (hover.value === null ? 0 : points.value[hover.value].x));
const leftPct = computed(() => (hover.value === null ? 0 : (hx.value / W) * 100));
const topPct = computed(() => (hover.value === null ? 0 : (points.value[hover.value].y / props.height) * 100));
</script>

<template>
  <div>
    <div
      ref="box" class="relative" :class="zoomable ? 'cursor-ew-resize touch-none select-none' : ''"
      @pointermove="onMove" @pointerleave="hover = null" @pointerdown="onDown" @pointerup="onUp" @wheel="onWheel"
    >
      <svg :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" class="block w-full" :style="{ height: height + 'px' }">
        <defs>
          <linearGradient id="la-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--accent)" stop-opacity="0.28" />
            <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line :x1="0" :y1="height - PAD" :x2="W" :y2="height - PAD" stroke="var(--color-line)" stroke-width="1" />
        <template v-if="visible.length">
          <path :key="'a' + drawKey" class="area-in" :d="paths.area" fill="url(#la-fill)" />
          <path :key="'l' + drawKey" class="line-in" pathLength="1" :d="paths.line" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          <line v-if="hover !== null" :x1="hx" :y1="PAD" :x2="hx" :y2="height - PAD" stroke="var(--color-faint)" stroke-width="1" vector-effect="non-scaling-stroke" />
        </template>
      </svg>

      <template v-if="hover !== null && visible.length">
        <div class="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          :style="{ left: leftPct + '%', top: topPct + '%', background: 'var(--accent)', boxShadow: '0 0 0 3px var(--color-bg)' }" />
        <div class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[140%] whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-1 text-center shadow-lg"
          :style="{ left: leftPct + '%', top: topPct + '%' }">
          <div class="tabular text-xs font-bold">{{ visible[hover] }} {{ visible[hover] === 1 ? 'play' : 'plays' }}</div>
          <div v-if="visibleLabels && visibleLabels[hover]" class="tabular text-[10px] text-faint">{{ visibleLabels[hover] }}</div>
        </div>
      </template>
    </div>

    <div v-if="zoomable && visibleLabels && visibleLabels.length" class="mt-1.5 flex items-center justify-between text-[10px] text-faint">
      <span class="tabular">{{ visibleLabels[0] }}</span>
      <button v-if="zoomed" class="font-semibold uppercase tracking-wide hover:text-text" @click="reset">Reset zoom</button>
      <span v-else class="uppercase tracking-wide opacity-70">scroll to zoom · drag to pan</span>
      <span class="tabular">{{ visibleLabels[visibleLabels.length - 1] }}</span>
    </div>
  </div>
</template>

<style scoped>
.line-in { stroke-dasharray: 1; animation: la-draw 0.7s var(--ease-out-quint) both; }
@keyframes la-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
.area-in { animation: la-fade 0.7s ease both; }
@keyframes la-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .line-in, .area-in { animation: none; } }
</style>
