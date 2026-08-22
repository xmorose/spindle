<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { api, dayWindow } from "@/api/client";
import { formatDayLabel, formatDuration, formatClock, formatTimeOfDay, cleanArtist } from "@/lib/format";
import type { Session, SessionTrack, Totals } from "@/api/types";
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
import CoverArt from "@/components/CoverArt.vue";
import NowPlayingBars from "@/components/NowPlayingBars.vue";
import Skeleton from "@/components/ui/Skeleton.vue";

const props = defineProps<{ day: number | null }>();
const emit = defineEmits<{ (e: "close"): void }>();

const player = usePlayerStore();
const sessions = ref<Session[]>([]);
const totals = ref<Totals | null>(null);
const loading = ref(false);

const dayStart = computed(() => (props.day === null ? 0 : dayWindow(props.day).from));
const heading = computed(() => (props.day === null ? "" : formatDayLabel(dayStart.value)));

let seq = 0;
watch(() => props.day, async (d) => {
  if (d === null) return;
  const mine = ++seq;
  loading.value = true;
  sessions.value = [];
  totals.value = null;
  const w = dayWindow(d);
  try {
    const [s, t] = await Promise.all([
      api.sessions({ from: w.from, to: w.to, limit: 25 }),
      api.totals({ from: w.from, to: w.to }),
    ]);
    if (mine !== seq) return;
    sessions.value = s;
    totals.value = t;
  } finally {
    if (mine === seq) loading.value = false;
  }
}, { immediate: true });

function onKey(e: KeyboardEvent) { if (e.key === "Escape") emit("close"); }
watch(() => props.day, (d) => {
  if (d === null) window.removeEventListener("keydown", onKey);
  else window.addEventListener("keydown", onKey);
}, { immediate: true });
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

function toPlayerTrack(t: SessionTrack): PlayerTrack {
  return { id: t.id, title: t.title, artist: t.artist, coverId: t.hasCoverArt ? t.id : null, artistId: t.artistId };
}
const dayQueue = computed<PlayerTrack[]>(() => sessions.value.flatMap((s) => s.tracks.map(toPlayerTrack)));
function playFrom(sessionIndex: number, i: number) {
  const before = sessions.value.slice(0, sessionIndex).reduce((n, x) => n + x.tracks.length, 0);
  player.playQueue(dayQueue.value, before + i);
}
function isCurrent(t: SessionTrack) { return player.current?.id === t.id; }
function span(s: Session) { return `${formatTimeOfDay(s.startedAt)} - ${formatTimeOfDay(s.endedAt)}`; }
const isEmpty = computed(() => !loading.value && sessions.value.length === 0);
</script>

<template>
  <Teleport to="body">
    <div v-if="day !== null" class="fixed inset-0 z-[60] flex justify-end">
      <div class="day-scrim absolute inset-0 bg-[oklch(0.1_0.02_50/0.6)] backdrop-blur-[2px]" @click="emit('close')"></div>

      <aside class="day-panel relative flex h-full w-full max-w-md flex-col border-l border-line bg-bg shadow-2xl">
        <header class="flex flex-none items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
          <div class="min-w-0">
            <div class="mt-1 truncate text-xl font-black tracking-tight">{{ heading }}</div>
            <div v-if="totals" class="tabular mt-1 text-[13px] text-muted">
              {{ totals.plays }} {{ totals.plays === 1 ? 'play' : 'plays' }} · {{ formatDuration(totals.seconds) }}
            </div>
          </div>
          <button class="-mr-1 flex-none rounded-lg p-1.5 text-faint transition-colors hover:bg-surface hover:text-text"
            aria-label="Close" @click="emit('close')">
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div v-if="loading" class="flex flex-col gap-5">
            <div v-for="i in 3" :key="i">
              <Skeleton class="h-2.5 w-24" />
              <div class="mt-3 flex flex-col gap-2">
                <div v-for="j in 3" :key="j" class="flex items-center gap-3">
                  <Skeleton class="h-9 w-9 flex-none rounded" />
                  <div class="flex-1">
                    <Skeleton class="h-3 w-40 max-w-full" />
                    <Skeleton class="mt-1.5 h-2.5 w-24" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p v-else-if="isEmpty" class="py-12 text-center text-sm text-faint">
            No timestamped plays on this day. The count comes from your baseline library history.
          </p>

          <section v-for="(s, si) in sessions" :key="s.startedAt" class="mb-6 last:mb-0">
            <div class="mb-2 flex items-baseline justify-between gap-3 border-b border-line/40 pb-1.5">
              <span class="tabular text-[12px] font-bold" :style="{ color: 'var(--accent)' }">{{ span(s) }}</span>
              <span class="tabular text-[11px] text-faint">{{ s.trackCount }} {{ s.trackCount === 1 ? 'track' : 'tracks' }} · {{ formatDuration(s.seconds) }}</span>
            </div>
            <div class="flex flex-col">
              <div v-for="(t, i) in s.tracks" :key="`${s.startedAt}-${i}`"
                class="group flex cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors duration-150 hover:bg-surface"
                @click="playFrom(si, i)">
                <div class="relative h-9 w-9 flex-none">
                  <CoverArt :id="t.hasCoverArt ? t.id : null" :name="t.title" :size="80" class="h-9 w-9 rounded" />
                  <span class="absolute inset-0 grid place-items-center rounded bg-[oklch(0.12_0.02_50/0.55)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 translate-x-px text-white" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                </div>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5">
                    <RouterLink :to="`/tracks/${t.id}`" @click.stop
                      class="block w-fit max-w-full truncate text-[13px] font-semibold hover:underline"
                      :style="isCurrent(t) ? { color: 'var(--accent)' } : undefined">{{ t.title }}</RouterLink>
                    <NowPlayingBars v-if="isCurrent(t) && player.playing" class="flex-none text-[var(--accent)]" />
                  </span>
                  <RouterLink :to="`/artists/${t.artistId}`" @click.stop
                    class="block w-fit max-w-full truncate text-[11px] text-faint transition-colors hover:text-text hover:underline">{{ cleanArtist(t.artist) }}</RouterLink>
                </span>
                <span v-if="t.plays > 1" class="tabular flex-none rounded-full px-1.5 py-px text-[10px] font-bold"
                  :style="{ background: 'var(--accent-soft)', color: 'var(--accent)' }">×{{ t.plays }}</span>
                <span class="tabular flex-none text-[11px] text-faint">{{ formatClock(t.duration) }}</span>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.day-panel { animation: day-in 280ms var(--ease-out-quint) both; }
.day-scrim { animation: fade 200ms ease both; }
@keyframes day-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .day-panel, .day-scrim { animation: none; } }
</style>
