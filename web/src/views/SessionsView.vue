<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { formatDuration, formatClock, formatDayLabel, formatTimeOfDay, cleanArtist } from "@/lib/format";
import { barWidth } from "@/lib/chart";
import type { Session, SessionTrack } from "@/api/types";
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
import CoverArt from "@/components/CoverArt.vue";
import NowPlayingBars from "@/components/NowPlayingBars.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const res = useRangedResource((p) => api.sessions({ ...p, limit: 30 }));
const sessions = computed(() => res.data.value ?? []);
const firstLoad = computed(() => res.loading.value && res.data.value === null);
const isEmpty = computed(() => !res.loading.value && sessions.value.length === 0);

const maxSeconds = computed(() => Math.max(1, ...sessions.value.map((s) => s.seconds)));

function covers(s: Session): { key: string; id: string }[] {
  const seen = new Set<string>();
  const out: { key: string; id: string }[] = [];
  for (const t of s.tracks) {
    if (!t.albumId || seen.has(t.albumId)) continue;
    seen.add(t.albumId);
    out.push({ key: t.albumId, id: t.albumId });
    if (out.length === 3) break;
  }
  return out;
}

const DAY = 86_400;
function secOfDay(ts: number) {
  const d = new Date(ts * 1000);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}
function daySegments(s: Session): { left: string; width: string }[] {
  if (s.endedAt - s.startedAt >= DAY) return [{ left: "0%", width: "100%" }];
  const a = secOfDay(s.startedAt);
  const b = secOfDay(s.endedAt);
  const seg = (from: number, to: number) => ({
    left: `${(from / DAY) * 100}%`,
    width: `${Math.max(2.5, ((to - from) / DAY) * 100)}%`,
  });
  if (b >= a) return [seg(a, b)];
  return [seg(a, DAY), seg(0, b)];
}
function spanLabel(s: Session) { return `${formatTimeOfDay(s.startedAt)} – ${formatTimeOfDay(s.endedAt)}`; }

const open = ref(new Set<number>());
function toggle(startedAt: number) {
  const next = new Set(open.value);
  if (next.has(startedAt)) next.delete(startedAt); else next.add(startedAt);
  open.value = next;
}

const player = usePlayerStore();
function toPlayerTrack(t: SessionTrack): PlayerTrack {
  return { id: t.id, title: t.title, artist: t.artist, coverId: t.hasCoverArt ? t.id : null, artistId: t.artistId };
}
function playSession(s: Session, start = 0) { player.playQueue(s.tracks.map(toPlayerTrack), start); }
function shuffleSession(s: Session) { player.playShuffled(s.tracks.map(toPlayerTrack)); }
function isCurrent(t: SessionTrack) { return player.current?.id === t.id; }
</script>

<template>
  <div class="py-2 rise">
    <h1 class="mb-6 text-3xl font-black tracking-tight">Sessions</h1>

    <div v-if="firstLoad" class="flex flex-col gap-1">
      <div v-for="i in 7" :key="i" class="flex items-center gap-4 px-2 py-3">
        <div class="flex">
          <Skeleton class="h-[52px] w-[52px] rounded-lg" />
          <Skeleton class="-ml-7 h-[52px] w-[52px] rounded-lg" />
          <Skeleton class="-ml-7 h-[52px] w-[52px] rounded-lg" />
        </div>
        <div class="flex-1">
          <Skeleton class="h-3.5 w-44 max-w-full" />
          <Skeleton class="mt-2 h-2.5 w-64 max-w-full" />
        </div>
        <Skeleton class="hidden h-2 w-[88px] sm:block" />
        <div class="flex flex-col items-end">
          <Skeleton class="h-3.5 w-14" />
          <Skeleton class="mt-1.5 h-2.5 w-16" />
        </div>
      </div>
    </div>

    <EmptyState v-else-if="isEmpty" title="No sessions yet"
      hint="Sessions appear once you have live listening. A session is a stretch of plays without a long pause." />

    <div v-else class="flex flex-col">
      <article v-for="s in sessions" :key="s.startedAt" class="border-b border-line/40 last:border-0">
        <button
          class="group w-full rounded-xl px-2 py-3 text-left transition-colors duration-150 hover:bg-surface/70"
          :class="{ 'bg-surface/40': open.has(s.startedAt) }"
          :aria-expanded="open.has(s.startedAt)"
          @click="toggle(s.startedAt)"
        >
          <div class="flex items-center gap-4">
            <div v-if="covers(s).length" class="flex flex-none">
              <CoverArt v-for="(c, ci) in covers(s)" :key="c.key" :id="c.id" :size="120"
                class="h-[52px] w-[52px] rounded-lg ring-2 ring-[var(--color-bg)]"
                :class="ci > 0 ? '-ml-7' : ''" :style="{ zIndex: 3 - ci }" />
            </div>
            <CoverArt v-else :id="null" name="♪" :size="120" class="h-[52px] w-[52px] flex-none rounded-lg" />

            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold">
                {{ formatDayLabel(s.startedAt) }}
                <span class="tabular text-faint"> · {{ formatTimeOfDay(s.startedAt) }}</span>
              </div>
              <div v-if="s.tracks.length" class="mt-0.5 truncate text-xs text-faint">
                kicked off with <span class="font-medium text-muted">{{ s.tracks[0].title }}</span>
              </div>
              <div class="mt-2 h-[3px] w-full max-w-[420px] rounded-full bg-surface-2">
                <div class="h-full rounded-full" :style="{ width: barWidth(s.seconds, maxSeconds), background: 'var(--accent)', opacity: 0.85 }" />
              </div>
            </div>

            <div class="relative hidden h-2 w-[88px] flex-none overflow-hidden rounded-full bg-surface-2 sm:block" :title="spanLabel(s)">
              <span class="absolute inset-y-0 left-1/2 w-px bg-line/70" />
              <span v-for="(seg, si) in daySegments(s)" :key="si"
                class="absolute inset-y-0 rounded-full" :style="{ left: seg.left, width: seg.width, background: 'var(--accent)' }" />
            </div>

            <div class="flex-none text-right">
              <div class="tabular text-sm font-bold" :style="{ color: 'var(--accent)' }">{{ formatDuration(s.seconds) }}</div>
              <div class="tabular text-[11px] text-faint">{{ s.trackCount }} {{ s.trackCount === 1 ? 'track' : 'tracks' }}</div>
            </div>

            <svg viewBox="0 0 24 24" class="h-4 w-4 flex-none text-faint transition-transform duration-200"
              :class="{ 'rotate-90': open.has(s.startedAt) }"
              fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </div>
        </button>

        <div class="expander" :class="{ open: open.has(s.startedAt) }">
          <div class="overflow-hidden">
            <div class="px-2 pb-4 pt-1">
              <div class="mb-3 flex items-center gap-2">
                <button v-if="s.tracks.length"
                  class="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold text-[color:var(--color-bg)] transition-transform duration-150 hover:scale-[1.03] active:scale-95"
                  :style="{ background: 'var(--accent)' }" @click="playSession(s)">
                  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 translate-x-px" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  Play
                </button>
                <button v-if="s.tracks.length > 1"
                  class="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:bg-surface hover:text-text"
                  @click="shuffleSession(s)">
                  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" />
                  </svg>
                  Shuffle
                </button>
                <span class="tabular ml-auto text-[11px] text-faint">{{ spanLabel(s) }}</span>
              </div>

              <div v-if="s.tracks.length" class="flex flex-col">
                <div v-for="(t, i) in s.tracks" :key="i"
                  class="group/row flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-surface-2/70"
                  @click="playSession(s, i)">
                  <span class="tabular w-5 flex-none text-right text-xs font-bold text-faint">{{ i + 1 }}</span>
                  <div class="relative h-8 w-8 flex-none">
                    <CoverArt :id="t.hasCoverArt ? t.id : null" :name="t.title" :size="80" class="h-8 w-8 rounded" />
                    <span class="absolute inset-0 grid place-items-center rounded bg-[oklch(0.12_0.02_50/0.55)] opacity-0 transition-opacity duration-150 group-hover/row:opacity-100">
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
                  <span v-if="t.plays > 1"
                    class="tabular flex-none rounded-full px-1.5 py-px text-[10px] font-bold"
                    :style="{ background: 'var(--accent-soft)', color: 'var(--accent)' }">×{{ t.plays }}</span>
                  <span class="tabular flex-none text-[11px] text-faint">{{ formatClock(t.duration) }}</span>
                </div>
              </div>
              <p v-else class="px-2 text-xs text-faint">The tracks from this session are no longer in your library.</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.expander {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms var(--ease-out-quint);
}
.expander.open { grid-template-rows: 1fr; }
@media (prefers-reduced-motion: reduce) {
  .expander { transition: none; }
}
</style>
