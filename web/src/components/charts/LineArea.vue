<script setup lang="ts">
import { computed } from "vue";
import { buildSeriesPaths } from "@/lib/chart";

const props = withDefaults(defineProps<{ values: number[]; height?: number }>(), { height: 160 });
const W = 900;
const paths = computed(() => buildSeriesPaths(props.values, W, props.height, 6));
const last = computed(() => {
  if (props.values.length === 0) return null;
  const { line } = paths.value;
  const coords = line.slice(1).split(" L");
  const [x, y] = coords[coords.length - 1].split(",").map(Number);
  return { x, y };
});
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" class="w-full" :style="{ height: height + 'px' }">
    <defs>
      <linearGradient id="la-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--accent)" stop-opacity="0.28" />
        <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <line :x1="0" :y1="height - 6" :x2="W" :y2="height - 6" stroke="var(--color-line)" stroke-width="1" />
    <template v-if="values.length">
      <path :d="paths.area" fill="url(#la-fill)" />
      <path :d="paths.line" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      <circle v-if="last" :cx="last.x" :cy="last.y" r="4" fill="var(--accent)" />
    </template>
  </svg>
</template>
