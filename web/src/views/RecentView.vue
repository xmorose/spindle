<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { api } from "@/api/client";
import { cleanArtist, formatTimeOfDay, formatDayLabel } from "@/lib/format";
import type { RecentPlay } from "@/api/types";
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
import CoverArt from "@/components/CoverArt.vue";
import Spinner from "@/components/ui/Spinner.vue";

const player = usePlayerStore();
const plays = ref<RecentPlay[]>([]);
const loading = ref(true);

onMounted(async () => {
  try { plays.value = await api.recent({ limit: 200 }); } finally { loading.value = false; }
});

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

const isEmpty = computed(() => !loading.value && plays.value.length === 0);

function toTrack(p: RecentPlay): PlayerTrack {
  return { id: p.id, title: p.title, artist: p.artist, coverId: p.hasCoverArt ? p.id : null, artistId: p.artistId };
}
function playFrom(i: number) {
  player.playQueue(plays.value.map(toTrack), i);
}
</script>

<template>
  <div class="py-2 rise">
    <h1 class="mb-6 text-3xl font-black tracking-tight">Recent</h1>

    <div v-if="loading" class="grid min-h-[40vh] place-items-center"><Spinner /></div>

    <div v-else-if="isEmpty" class="py-16 text-center text-sm text-faint">
      No plays yet. Listening shows up here as soon as it lands.
    </div>

    <div v-else class="flex flex-col gap-8">
      <section v-for="g in groups" :key="g.label">
        <div class="label mb-2 border-b border-line/50 pb-2">{{ g.label }}</div>
        <div class="flex flex-col">
          <div
            v-for="item in g.items" :key="item.i"
            class="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-surface"
            @click="playFrom(item.i)"
          >
            <div class="relative h-10 w-10 flex-none">
              <CoverArt :id="item.play.hasCoverArt ? item.play.id : null" :name="item.play.title" :size="80" class="h-10 w-10 rounded" />
              <span class="absolute inset-0 grid place-items-center rounded bg-[oklch(0.12_0.02_50/0.55)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <svg viewBox="0 0 24 24" class="h-4 w-4 translate-x-px text-white" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <RouterLink :to="`/tracks/${item.play.id}`" @click.stop class="block w-fit max-w-full truncate text-sm font-semibold transition-colors group-hover:text-text hover:underline">{{ item.play.title }}</RouterLink>
              <component :is="item.play.artistId ? 'RouterLink' : 'span'" :to="item.play.artistId ? `/artists/${item.play.artistId}` : undefined" @click.stop
                class="block w-fit max-w-full truncate text-xs text-faint" :class="item.play.artistId ? 'transition-colors hover:text-text hover:underline' : ''">{{ cleanArtist(item.play.artist) }}</component>
            </div>
            <span class="tabular flex-none text-xs text-faint">{{ formatTimeOfDay(item.play.playedAt) }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
