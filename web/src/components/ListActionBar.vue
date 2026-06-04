<script setup lang="ts">
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
import { createShareLink } from "@/composables/useShare";

const props = defineProps<{ tracks: PlayerTrack[]; count?: number }>();
const player = usePlayerStore();

function playAll() { player.playQueue(props.tracks, 0); }
function shuffle() { player.playShuffled(props.tracks); }
function shareList() { void createShareLink({ kind: "queue", trackIds: props.tracks.map((t) => t.id) }); }
</script>

<template>
  <div v-if="tracks.length" class="mb-5 flex flex-wrap items-center gap-2">
    <button class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-[color:var(--color-bg)] transition-transform duration-150 hover:scale-[1.03] active:scale-95" :style="{ background: 'var(--accent)' }" @click="playAll">
      <svg viewBox="0 0 24 24" class="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
      Alles abspielen
    </button>
    <button class="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-text" @click="shuffle">
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>
      Shuffle
    </button>
    <button class="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-text" @click="shareList">
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>
      Liste teilen
    </button>
    <span v-if="count" class="tabular ml-auto text-xs text-faint">{{ count }} Songs</span>
  </div>
</template>
