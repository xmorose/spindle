<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import type { FlowData } from "@/api/types";
import { coverUrl } from "@/api/client";
import { FLOW_W as W, FLOW_H as H, streamGeometry, fallbackFlowColor, formatFlowPlays, type FlowMetric } from "@/lib/flow";
import { cleanArtist, formatDate, formatDuration } from "@/lib/format";

const props = defineProps<{
  flow: FlowData;
  metric: FlowMetric;
  colors: Record<string, string>;
  artwork: boolean;
  selected: string | null;
  busy: boolean;
}>();
const emit = defineEmits<{ select: [id: string]; zoom: [range: { from: number; to: number }] }>();

const MIN_DRAG = 0.025;
const TICKS = 5;
const TILE = 175;
const TIP_W = 208;

const uid = useId().replace(/:/g, "");
const box = ref<HTMLElement | null>(null);
const hover = ref<{ id: string; index: number; x: number } | null>(null);
const drag = ref<{ a: number; b: number } | null>(null);
const failedCovers = ref(new Set<string>());

watch(() => props.flow, () => { hover.value = null; drag.value = null; });

const last = computed(() => props.flow.starts.length - 1);
const layers = computed(() => streamGeometry(props.flow, props.metric));
const active = computed(() => hover.value?.id ?? props.selected);
const tooltip = computed(() => props.flow.series.find((s) => s.id === hover.value?.id));
const ticks = computed(() => {
  const count = Math.min(TICKS, props.flow.starts.length);
  return [...new Set(Array.from({ length: count }, (_, i) => Math.round((i * last.value) / Math.max(1, count - 1))))];
});

const color = (id: string) => props.colors[id] ?? fallbackFlowColor(id);
const tickX = (i: number) => (i * W) / Math.max(1, last.value);
const bucketStart = (i: number) => Math.max(props.flow.from, props.flow.starts[i]);
const bucketEnd = (i: number) => Math.min(props.flow.to, props.flow.ends[i]);
const tickLabel = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-US",
  props.flow.bucket === "day" ? { month: "short", day: "numeric" } : { month: "short", year: "numeric" });
const showsCover = (cover: string | null): cover is string => props.artwork && !!cover && !failedCovers.value.has(cover);

function ratio(event: PointerEvent): number {
  const rect = box.value!.getBoundingClientRect();
  return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
}

function move(event: PointerEvent) {
  if (props.busy || !box.value) return;
  const x = ratio(event);
  if (drag.value) { drag.value.b = x; return; }
  const id = (event.target as Element).closest<SVGPathElement>("[data-series]")?.dataset.series;
  hover.value = id ? { id, index: Math.round(x * last.value), x } : null;
}

function down(event: PointerEvent) {
  if (props.busy || event.button !== 0 || !box.value) return;
  move(event);
  const x = ratio(event);
  drag.value = { a: x, b: x };
  box.value.setPointerCapture(event.pointerId);
}

function up(event: PointerEvent) {
  const selection = drag.value;
  drag.value = null;
  if (box.value?.hasPointerCapture(event.pointerId)) box.value.releasePointerCapture(event.pointerId);
  if (!selection || props.busy) return;
  const low = Math.min(selection.a, selection.b);
  const high = Math.max(selection.a, selection.b);
  if (high - low < MIN_DRAG) {
    if (hover.value) emit("select", hover.value.id);
    return;
  }
  const from = bucketStart(Math.floor(low * last.value));
  const to = bucketEnd(Math.ceil(high * last.value));
  if (from < to && (from > props.flow.from || to < props.flow.to)) emit("zoom", { from, to });
  hover.value = null;
}

function cancel() {
  drag.value = null;
  hover.value = null;
}
</script>

<template>
  <div class="min-w-0">
    <div
      ref="box"
      class="flow-plot relative h-[400px] touch-pan-y select-none sm:h-[560px]"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="cancel"
      @pointerleave="hover = null"
    >
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
        class="relative h-full w-full overflow-visible"
        role="img"
        aria-label="Listening over time. Select a cover below to highlight its stream; drag a period to explore it."
      >
        <defs>
          <pattern v-for="(layer, i) in layers" :id="`${uid}-${i}`" :key="layer.series.id" patternUnits="userSpaceOnUse" :width="TILE" :height="TILE">
            <rect :width="TILE" :height="TILE" :fill="color(layer.series.id)" />
            <image
              v-if="showsCover(layer.series.coverArt)"
              :href="coverUrl(layer.series.coverArt, 300)"
              :width="TILE"
              :height="TILE"
              preserveAspectRatio="xMidYMid slice"
              @error="failedCovers.add(layer.series.coverArt)"
            />
          </pattern>
        </defs>
        <line
          v-for="i in ticks"
          :key="i"
          :x1="tickX(i)"
          :x2="tickX(i)"
          y1="0"
          :y2="H"
          stroke="var(--color-line)"
          stroke-opacity="0.35"
          stroke-dasharray="2 6"
        />
        <g v-for="(layer, i) in layers" :key="layer.series.id" class="flow-layer" :opacity="active && active !== layer.series.id ? 0.16 : 1">
          <path
            :d="layer.path"
            :fill="artwork ? `url(#${uid}-${i})` : color(layer.series.id)"
            :data-series="layer.series.id"
            stroke="var(--color-bg)"
            stroke-width="0.8"
            vector-effect="non-scaling-stroke"
          />
          <path
            :d="layer.topPath"
            fill="none"
            :stroke="active === layer.series.id ? 'var(--color-text)' : 'var(--color-bg)'"
            :stroke-opacity="active === layer.series.id ? 0.9 : 0.65"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
            pointer-events="none"
          />
        </g>
      </svg>
      <div
        v-if="drag"
        class="pointer-events-none absolute inset-y-0 border-x border-[var(--accent)] bg-[var(--accent-soft)]"
        :style="{ left: `${Math.min(drag.a, drag.b) * 100}%`, width: `${Math.abs(drag.a - drag.b) * 100}%` }"
      />
      <div
        v-if="tooltip && hover && !drag"
        class="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs shadow-lg"
        :style="{ width: `${TIP_W}px`, left: `clamp(0px, calc(${hover.x * 100}% - ${TIP_W / 2}px), calc(100% - ${TIP_W}px))` }"
      >
        <div class="truncate font-bold">{{ flow.group === "artist" ? cleanArtist(tooltip.name) : tooltip.name }}</div>
        <div class="mt-1 text-muted">
          {{ metric === "time" ? formatDuration(tooltip.seconds[hover.index] ?? 0) : formatFlowPlays(tooltip.plays[hover.index] ?? 0) }}
        </div>
        <div class="mt-1 text-[10px] text-faint">
          {{ formatDate(bucketStart(hover.index)) }}<template v-if="flow.bucket !== 'day'"> – {{ formatDate(bucketEnd(hover.index)) }}</template>
        </div>
      </div>
    </div>
    <div class="mt-4 flex justify-between gap-3 text-[10px] text-faint sm:text-xs" aria-hidden="true">
      <span v-for="(i, n) in ticks" :key="i" :class="{ 'hidden sm:inline': n > 0 && n < ticks.length - 1 }">{{ tickLabel(bucketStart(i)) }}</span>
    </div>
  </div>
</template>

<style scoped>
.flow-layer { transition: opacity 180ms ease-out; }
.flow-plot { cursor: crosshair; }
@media (prefers-reduced-motion: reduce) { .flow-layer { transition: none; } }
</style>
