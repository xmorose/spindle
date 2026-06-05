<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
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

const visible = computed(() =>
  props.zoomable ? props.values.slice(Math.round(win.value.s), Math.round(win.value.e)) : props.values,
);
const visibleLabels = computed(() =>
  props.labels ? (props.zoomable ? props.labels.slice(Math.round(win.value.s), Math.round(win.value.e)) : props.labels) : undefined,
);
const zoomed = computed(() => props.zoomable && (win.value.s > 0.5 || win.value.e < props.values.length - 0.5));

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

// Animated window changes (tween the index window so zoom/reset glides instead of snapping).
const reduceMotion = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
let raf = 0;
function setWindow(target: { s: number; e: number }) {
  const to = { s: Math.max(0, target.s), e: Math.min(props.values.length, target.e) };
  cancelAnimationFrame(raf);
  if (reduceMotion) { win.value = to; return; }
  const from = { ...win.value };
  const start = performance.now();
  const dur = 260;
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  function frame(now: number) {
    const t = Math.min(1, (now - start) / dur);
    const k = ease(t);
    win.value = { s: from.s + (to.s - from.s) * k, e: from.e + (to.e - from.e) * k };
    if (t < 1) raf = requestAnimationFrame(frame); else win.value = to;
  }
  raf = requestAnimationFrame(frame);
}
onUnmounted(() => cancelAnimationFrame(raf));

function reset() { setWindow({ s: 0, e: props.values.length }); }

const hover = ref<number | null>(null);
const sel = ref<{ a: number; b: number } | null>(null); // drag selection, ratios 0..1 across the box

function ratioOf(e: PointerEvent): number {
  const rect = box.value!.getBoundingClientRect();
  return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
}
function onDown(e: PointerEvent) {
  if (!props.zoomable || !box.value) return;
  const r = ratioOf(e);
  sel.value = { a: r, b: r };
  hover.value = null;
  box.value.setPointerCapture(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (!box.value) return;
  if (sel.value) { sel.value = { a: sel.value.a, b: ratioOf(e) }; return; }
  const n = visible.value.length;
  if (!n) return;
  hover.value = Math.max(0, Math.min(n - 1, Math.round(ratioOf(e) * (n - 1))));
}
function onUp() {
  const s = sel.value;
  sel.value = null;
  if (!s) return;
  const lo = Math.min(s.a, s.b), hi = Math.max(s.a, s.b);
  const span = win.value.e - win.value.s;
  const a0 = win.value.s + lo * span;
  const a1 = win.value.s + hi * span;
  if (hi - lo >= 0.03 && a1 - a0 >= 2) setWindow({ s: Math.round(a0), e: Math.round(a1) });
}

const selStyle = computed(() =>
  sel.value
    ? { left: Math.min(sel.value.a, sel.value.b) * 100 + "%", width: Math.abs(sel.value.b - sel.value.a) * 100 + "%" }
    : null,
);

const hoverPoint = computed(() => (hover.value === null ? null : points.value[hover.value] ?? null));
const hx = computed(() => hoverPoint.value?.x ?? 0);
const leftPct = computed(() => (hoverPoint.value ? (hoverPoint.value.x / W) * 100 : 0));
const topPct = computed(() => (hoverPoint.value ? (hoverPoint.value.y / props.height) * 100 : 0));
</script>

<template>
  <div>
    <div
      ref="box" class="relative" :class="zoomable ? 'cursor-crosshair touch-none select-none' : ''"
      @pointermove="onMove" @pointerleave="hover = null" @pointerdown="onDown" @pointerup="onUp"
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
          <line v-if="hoverPoint" :x1="hx" :y1="PAD" :x2="hx" :y2="height - PAD" stroke="var(--color-faint)" stroke-width="1" vector-effect="non-scaling-stroke" />
        </template>
      </svg>

      <div v-if="selStyle" class="pointer-events-none absolute inset-y-0 rounded-sm bg-[var(--accent)] opacity-20" :style="selStyle"></div>

      <template v-if="hoverPoint !== null && hover !== null">
        <div class="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          :style="{ left: leftPct + '%', top: topPct + '%', background: 'var(--accent)', boxShadow: '0 0 0 3px var(--color-bg)' }" />
        <div class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[140%] whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-1 text-center shadow-lg"
          :style="{ left: leftPct + '%', top: topPct + '%' }">
          <div class="tabular text-xs font-bold">{{ visible[hover] }} {{ visible[hover] === 1 ? 'play' : 'plays' }}</div>
          <div v-if="visibleLabels && visibleLabels[hover]" class="tabular text-[10px] text-faint">{{ visibleLabels[hover] }}</div>
        </div>
      </template>
    </div>

    <div v-if="zoomable" class="mt-1.5 flex items-center justify-between text-[10px] text-faint">
      <span class="tabular">{{ visibleLabels ? visibleLabels[0] : "" }}</span>
      <button v-if="zoomed" class="font-semibold uppercase tracking-wide transition-colors hover:text-text" @click="reset">Reset zoom</button>
      <span v-else class="uppercase tracking-wide opacity-70">Ziehen zum Zoomen</span>
      <span class="tabular">{{ visibleLabels ? visibleLabels[visibleLabels.length - 1] : "" }}</span>
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
