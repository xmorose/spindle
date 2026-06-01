<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "@/stores/player";
import { cleanArtist, formatDuration } from "@/lib/format";
import CoverArt from "@/components/CoverArt.vue";

const p = usePlayerStore();
const pct = computed(() => (p.duration ? (p.currentTime / p.duration) * 100 : 0));
function scrub(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  if (p.duration) p.seek((v / 100) * p.duration);
}
</script>

<template>
  <div v-if="p.current" class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-[color-mix(in_oklch,var(--color-bg),transparent_8%)] backdrop-blur">
    <div class="flex items-center gap-4 px-5 py-3">
      <CoverArt :id="p.current.coverId" :name="p.current.title" :size="80" class="h-11 w-11 flex-none" />
      <div class="min-w-0 w-48 flex-none">
        <div class="truncate text-sm font-semibold">{{ p.current.title }}</div>
        <div class="truncate text-xs text-faint">{{ cleanArtist(p.current.artist) }}</div>
      </div>
      <button class="flex-none rounded-full p-1 text-muted hover:text-text" @click="p.prev()" aria-label="Previous">⏮</button>
      <button class="flex-none rounded-full px-2 py-1 text-lg" :style="{ color: 'var(--accent)' }" @click="p.toggle()" :aria-label="p.playing ? 'Pause' : 'Play'">{{ p.playing ? "⏸" : "▶" }}</button>
      <button class="flex-none rounded-full p-1 text-muted hover:text-text" @click="p.next()" aria-label="Next">⏭</button>
      <span class="tabular w-10 flex-none text-right text-xs text-faint">{{ formatDuration(p.currentTime) }}</span>
      <input type="range" min="0" max="100" :value="pct" @input="scrub" class="h-1 flex-1 cursor-pointer accent-[var(--accent)]" aria-label="Seek" />
      <span class="tabular w-10 flex-none text-xs text-faint">{{ formatDuration(p.duration) }}</span>
    </div>
  </div>
</template>
