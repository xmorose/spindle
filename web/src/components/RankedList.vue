<script setup lang="ts">
import { computed } from "vue";
import { getActivePinia } from "pinia";
import CoverArt from "./CoverArt.vue";
import { usePlayerStore } from "@/stores/player";

export interface RankedRow {
  id: string;
  title: string;
  subtitle?: string;
  value: number;
  valueLabel?: string;
  coverId?: string | null;
  to?: string;
}

const props = defineProps<{ rows: RankedRow[]; playable?: boolean }>();
const max = computed(() => Math.max(...props.rows.map((r) => r.value), 1));
function pct(v: number) {
  return `${Math.max(2, Math.round((v / max.value) * 100))}%`;
}

function play(i: number) {
  if (!getActivePinia()) return;
  const player = usePlayerStore();
  player.playQueue(props.rows.map((r) => ({ id: r.id, title: r.title, artist: r.subtitle ?? "", coverId: r.coverId ?? null })), i);
}
</script>

<template>
  <div v-if="rows.length" class="flex flex-col">
    <component
      :is="row.to ? 'RouterLink' : 'div'"
      v-for="(row, i) in rows"
      :key="row.id"
      :to="row.to"
      class="group flex items-center gap-3 border-b border-line/40 py-2.5 last:border-0"
    >
      <span class="tabular w-6 text-right text-xs font-bold text-faint relative">
        <span v-if="playable" class="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center">
          <button class="text-[var(--accent)] leading-none" @click.prevent.stop="play(i)" aria-label="Play">▶</button>
        </span>
        <span :class="playable ? 'group-hover:opacity-0' : ''">{{ i + 1 }}</span>
      </span>
      <CoverArt :id="row.coverId ?? null" :name="row.title" :size="80" class="h-9 w-9 flex-none" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-[13.5px] font-semibold group-hover:text-text">{{ row.title }}</div>
        <div v-if="row.subtitle" class="truncate text-[11.5px] text-faint">{{ row.subtitle }}</div>
        <div class="mt-1 h-1 rounded-full bg-surface-2">
          <div data-bar class="h-1 rounded-full" :style="{ width: pct(row.value), background: 'var(--accent)' }" />
        </div>
      </div>
      <span class="tabular text-[12.5px] font-semibold text-muted">{{ row.valueLabel ?? row.value }}</span>
    </component>
  </div>
  <div v-else class="py-10 text-center text-sm text-faint">Nothing here yet.</div>
</template>
