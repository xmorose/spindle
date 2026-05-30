<script setup lang="ts">
import { computed } from "vue";
import type { HeatCell } from "@/api/types";
import { heatmapGrid } from "@/lib/stats";

const props = defineProps<{ cells: HeatCell[] }>();
const grid = computed(() => heatmapGrid(props.cells));
const max = computed(() => Math.max(1, ...grid.value.flat()));
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function opacity(v: number) { return v === 0 ? 0.06 : 0.18 + 0.82 * (v / max.value); }
</script>

<template>
  <div class="flex flex-col gap-1">
    <div v-for="(row, d) in grid" :key="d" class="flex items-center gap-1">
      <span class="w-8 text-[10px] font-semibold text-faint">{{ days[d] }}</span>
      <div class="flex gap-[3px]">
        <div v-for="(v, h) in row" :key="h" data-cell
          class="h-3.5 w-3.5 rounded-[3px]"
          :style="{ background: 'var(--accent)', opacity: opacity(v) }"
          :title="`${days[d]} ${String(h).padStart(2,'0')}:00 — ${v} plays`" />
      </div>
    </div>
  </div>
</template>
