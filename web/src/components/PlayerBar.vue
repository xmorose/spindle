<script setup lang="ts">
import { computed, ref } from "vue";
import { usePlayerStore } from "@/stores/player";
import { cleanArtist, formatClock } from "@/lib/format";
import CoverArt from "@/components/CoverArt.vue";

const p = usePlayerStore();

const bar = ref<HTMLElement | null>(null);
const dragging = ref(false);
const dragPct = ref(0);

const pct = computed(() => (p.duration ? Math.min(100, (p.currentTime / p.duration) * 100) : 0));
const fill = computed(() => (dragging.value ? dragPct.value : pct.value));
const elapsed = computed(() => formatClock(dragging.value ? (dragPct.value / 100) * p.duration : p.currentTime));

function ratio(e: PointerEvent): number {
  const r = bar.value!.getBoundingClientRect();
  return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
}
function down(e: PointerEvent) {
  if (!bar.value || !p.duration) return;
  dragging.value = true;
  dragPct.value = ratio(e) * 100;
  bar.value.setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (dragging.value) dragPct.value = ratio(e) * 100;
}
function up(e: PointerEvent) {
  if (!dragging.value) return;
  const t = ratio(e) * p.duration;
  dragging.value = false;
  p.seek(t);
}
function nudge(by: number) {
  if (p.duration) p.seek(Math.max(0, Math.min(p.duration, p.currentTime + by)));
}
</script>

<template>
  <Transition name="player">
    <div v-if="p.current" class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-[color-mix(in_oklch,var(--color-bg),transparent_8%)] backdrop-blur">
      <div class="flex items-center gap-4 px-5 py-3">
        <CoverArt :id="p.current.coverId" :name="p.current.title" :size="80" class="h-11 w-11 flex-none rounded-sm" />
        <div class="min-w-0 w-48 flex-none">
          <div class="truncate text-sm font-semibold">{{ p.current.title }}</div>
          <div class="truncate text-xs text-faint">{{ cleanArtist(p.current.artist) }}</div>
        </div>

        <button class="flex-none rounded-full p-1.5 text-muted transition-colors hover:text-text" @click="p.prev()" aria-label="Previous">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zM20 6L9 12l11 6V6z" /></svg>
        </button>
        <button
          class="grid h-9 w-9 flex-none place-items-center rounded-full text-[color:var(--color-bg)] transition-transform duration-150 hover:scale-105 active:scale-95"
          :style="{ background: 'var(--accent)' }" @click="p.toggle()" :aria-label="p.playing ? 'Pause' : 'Play'"
        >
          <Transition name="icon" mode="out-in">
            <svg v-if="p.playing" key="pause" viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            <svg v-else key="play" viewBox="0 0 24 24" class="h-[18px] w-[18px] translate-x-px" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </Transition>
        </button>
        <button class="flex-none rounded-full p-1.5 text-muted transition-colors hover:text-text" @click="p.next()" aria-label="Next">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M16 6h2v12h-2zM4 6l11 6L4 18V6z" /></svg>
        </button>

        <span class="tabular w-12 flex-none text-right text-xs text-faint">{{ elapsed }}</span>
        <div
          ref="bar"
          class="group relative h-6 flex-1 cursor-pointer touch-none select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          role="slider" tabindex="0"
          :aria-valuemin="0" :aria-valuemax="Math.round(p.duration) || 0" :aria-valuenow="Math.round(p.currentTime)" aria-label="Seek"
          @pointerdown="down" @pointermove="move" @pointerup="up"
          @keydown.left.prevent="nudge(-5)" @keydown.right.prevent="nudge(5)"
        >
          <div class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-line">
            <div class="h-full rounded-full" :style="{ width: fill + '%', background: 'var(--accent)' }"></div>
          </div>
          <div
            class="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            :class="{ '!opacity-100': dragging }"
            :style="{ left: fill + '%', background: 'var(--accent)', boxShadow: '0 0 0 4px var(--color-bg)' }"
          ></div>
        </div>
        <span class="tabular w-12 flex-none text-xs text-faint">{{ formatClock(p.duration) }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.player-enter-active { transition: transform 0.45s var(--ease-out-quint); }
.player-enter-from { transform: translateY(100%); }

.icon-enter-active, .icon-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.icon-enter-from, .icon-leave-to { opacity: 0; transform: scale(0.6); }

@media (prefers-reduced-motion: reduce) {
  .player-enter-active, .icon-enter-active, .icon-leave-active { transition: none; }
}
</style>
