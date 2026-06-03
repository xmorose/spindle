<script setup lang="ts">
import { computed, ref } from "vue";
import { getActivePinia } from "pinia";
import CoverArt from "./CoverArt.vue";
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
import { createShareLink } from "@/composables/useShare";

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

const trackOf = (r: RankedRow): PlayerTrack => ({ id: r.id, title: r.title, artist: r.subtitle ?? "", coverId: r.coverId ?? null });

function play(i: number) {
  if (!getActivePinia()) return;
  usePlayerStore().playQueue(props.rows.map(trackOf), i);
}

const openIdx = ref<number | null>(null);
function playNext(i: number) {
  if (getActivePinia()) usePlayerStore().playNext([trackOf(props.rows[i])]);
  openIdx.value = null;
}
function addQueue(i: number) {
  if (getActivePinia()) usePlayerStore().addToQueue([trackOf(props.rows[i])]);
  openIdx.value = null;
}
function share(i: number) {
  void createShareLink({ kind: "track", trackIds: [props.rows[i].id] });
  openIdx.value = null;
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
      <div class="relative flex items-center gap-1.5">
        <span class="tabular text-[12.5px] font-semibold text-muted">{{ row.valueLabel ?? row.value }}</span>
        <template v-if="playable">
          <button
            class="flex-none rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
            :class="{ '!opacity-100 text-text': openIdx === i }"
            @click.prevent.stop="openIdx = openIdx === i ? null : i" aria-label="More actions"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </button>
          <div v-if="openIdx === i" class="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-xl">
            <button class="block w-full px-3 py-1.5 text-left text-[13px] font-medium hover:bg-surface-2" @click.prevent.stop="playNext(i)">Play next</button>
            <button class="block w-full px-3 py-1.5 text-left text-[13px] font-medium hover:bg-surface-2" @click.prevent.stop="addQueue(i)">Add to queue</button>
            <button class="block w-full px-3 py-1.5 text-left text-[13px] font-medium hover:bg-surface-2" @click.prevent.stop="share(i)">Teilen</button>
          </div>
        </template>
      </div>
    </component>
  </div>
  <div v-else class="py-10 text-center text-sm text-faint">Nothing here yet.</div>
  <div v-if="openIdx !== null" class="fixed inset-0 z-10" @click="openIdx = null"></div>
</template>
