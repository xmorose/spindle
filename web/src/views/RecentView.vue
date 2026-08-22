<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { api } from "@/api/client";
import { useUserStore } from "@/stores/user";
import { cleanArtist, formatTimeOfDay, formatDayLabel } from "@/lib/format";
import type { RecentPlay } from "@/api/types";
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
import CoverArt from "@/components/CoverArt.vue";
import VinylRecord from "@/components/VinylRecord.vue";
import NowPlayingBars from "@/components/NowPlayingBars.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import SkeletonList from "@/components/ui/SkeletonList.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import { useCoverAccent } from "@/composables/useCoverAccent";

const player = usePlayerStore();
const plays = ref<RecentPlay[]>([]);
const loading = ref(true);
const { user } = storeToRefs(useUserStore());

async function load() {
  loading.value = true;
  try { plays.value = await api.recent({ limit: 200 }); } finally { loading.value = false; }
}
watch(user, load, { immediate: true });

const tick = ref(Date.now());
const timer = setInterval(() => { tick.value = Date.now(); }, 60_000);
onUnmounted(() => clearInterval(timer));

const groups = computed(() => {
  const out: { label: string; items: { play: RecentPlay; i: number }[] }[] = [];
  let cur: (typeof out)[number] | null = null;
  plays.value.forEach((play, i) => {
    const label = formatDayLabel(play.playedAt);
    if (!cur || cur.label !== label) { cur = { label, items: [] }; out.push(cur); }
    cur.items.push({ play, i });
  });
  return out;
});

const latest = computed(() => plays.value[0] ?? null);
const isEmpty = computed(() => !loading.value && plays.value.length === 0);
useCoverAccent(() => { const p = latest.value; return p?.hasCoverArt ? p.id : null; });

function sinceLabel(unixSeconds: number): string {
  const mins = Math.floor((tick.value / 1000 - unixSeconds) / 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function toTrack(p: RecentPlay): PlayerTrack {
  return { id: p.id, title: p.title, artist: p.artist, coverId: p.hasCoverArt ? p.id : null, artistId: p.artistId };
}
function playFrom(i: number) {
  player.playQueue(plays.value.map(toTrack), i);
}
function isCurrent(p: RecentPlay) { return player.current?.id === p.id; }
</script>

<template>
  <div class="pb-2">
    <h1 class="mb-7 text-3xl font-black tracking-tight">Recent</h1>

    <template v-if="loading">
      <div class="mb-11 flex items-center gap-6">
        <Skeleton class="h-[130px] w-[130px] flex-none rounded-full" />
        <div class="min-w-0 flex-1">
          <Skeleton class="h-2.5 w-24" />
          <Skeleton class="mt-3 h-8 w-72 max-w-full" />
          <Skeleton class="mt-3 h-3 w-40 max-w-full" />
        </div>
      </div>
      <SkeletonList :rows="12" :bar="false" />
    </template>

    <EmptyState v-else-if="isEmpty" title="No plays yet"
      hint="Listening shows up here as soon as it lands." />

    <div v-else class="stagger">
      <section v-if="latest" class="mb-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <button class="flex-none self-start" @click="playFrom(0)" aria-label="Play">
          <VinylRecord :id="latest.hasCoverArt ? latest.id : null" :name="latest.title"
            :playing="isCurrent(latest) && player.playing" class="h-[130px] w-[130px] sm:h-[150px] sm:w-[150px]" />
        </button>
        <div class="min-w-0">
          <div class="label">Last played</div>
          <RouterLink :to="`/tracks/${latest.id}`"
            class="mt-2 block truncate text-3xl font-black leading-[0.95] tracking-tight hover:underline sm:text-5xl">{{ latest.title }}</RouterLink>
          <component :is="latest.artistId ? 'RouterLink' : 'span'" :to="latest.artistId ? `/artists/${latest.artistId}` : undefined"
            class="mt-2 block truncate text-[15px] text-muted"
            :class="latest.artistId ? 'transition-colors hover:text-text hover:underline' : ''">{{ cleanArtist(latest.artist) }}</component>
          <div class="tabular mt-3 text-[13px] font-semibold" :style="{ color: 'var(--accent)' }">{{ sinceLabel(latest.playedAt) }}</div>
        </div>
      </section>

      <section v-for="g in groups" :key="g.label" class="mb-9 last:mb-0">
        <div class="mb-3 flex items-baseline justify-between gap-3 border-b border-line/50 pb-2">
          <span class="label">{{ g.label }}</span>
          <span class="tabular text-[11px] text-faint">{{ g.items.length }} {{ g.items.length === 1 ? 'play' : 'plays' }}</span>
        </div>
        <div class="flex flex-col">
          <div
            v-for="item in g.items" :key="item.i"
            class="group flex cursor-pointer items-stretch gap-3 rounded-r-lg transition-colors hover:bg-surface"
            @click="playFrom(item.i)"
          >
            <span class="tabular w-11 flex-none self-center text-right text-[11px] text-faint">{{ formatTimeOfDay(item.play.playedAt) }}</span>
            <span class="w-px flex-none" :style="{ background: isCurrent(item.play) ? 'var(--accent)' : 'var(--color-line)', opacity: isCurrent(item.play) ? 0.9 : 0.45 }" />
            <div class="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3.5 pr-2">
              <div class="relative h-10 w-10 flex-none">
                <CoverArt :id="item.play.hasCoverArt ? item.play.id : null" :name="item.play.title" :size="80" class="h-10 w-10 rounded" />
                <span class="absolute inset-0 grid place-items-center rounded bg-[oklch(0.12_0.02_50/0.55)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <svg viewBox="0 0 24 24" class="h-4 w-4 translate-x-px text-white" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <RouterLink :to="`/tracks/${item.play.id}`" @click.stop
                    class="block w-fit max-w-full truncate text-sm font-semibold hover:underline"
                    :style="isCurrent(item.play) ? { color: 'var(--accent)' } : undefined">{{ item.play.title }}</RouterLink>
                  <NowPlayingBars v-if="isCurrent(item.play) && player.playing" class="flex-none text-[var(--accent)]" />
                </div>
                <component :is="item.play.artistId ? 'RouterLink' : 'span'" :to="item.play.artistId ? `/artists/${item.play.artistId}` : undefined" @click.stop
                  class="block w-fit max-w-full truncate text-xs text-faint" :class="item.play.artistId ? 'transition-colors hover:text-text hover:underline' : ''">{{ cleanArtist(item.play.artist) }}</component>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
