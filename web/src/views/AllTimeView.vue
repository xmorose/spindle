<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { api } from "@/api/client";
import { useUserStore } from "@/stores/user";
import { formatNumber, formatDuration, cleanArtist } from "@/lib/format";
import type { Totals } from "@/api/types";
import StatTile from "@/components/StatTile.vue";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import SkeletonList from "@/components/ui/SkeletonList.vue";

const totals = ref<Totals | null>(null);
const artistRows = ref<RankedRow[]>([]);
const trackRows = ref<RankedRow[]>([]);
const loading = ref(true);
const { user } = storeToRefs(useUserStore());

async function load() {
  loading.value = true;
  const [t, ar, tr] = await Promise.all([
    api.totals({ range: "all" }),
    api.topArtists({ range: "all", limit: 10 }),
    api.topTracks({ range: "all", limit: 10 }),
  ]);
  totals.value = t;
  artistRows.value = ar.map((a) => ({ id: a.artistId, title: cleanArtist(a.name), value: a.plays, coverId: a.coverArt, to: `/artists/${a.artistId}` }));
  trackRows.value = tr.map((x) => ({ id: x.id, title: x.title, subtitle: cleanArtist(x.artist), value: x.plays, coverId: x.hasCoverArt ? x.id : null, to: `/tracks/${x.id}`, artistId: x.artistId }));
  loading.value = false;
}
watch(user, load, { immediate: true });

const tiles = computed(() => totals.value ? [
  { label: "Total plays", value: formatNumber(totals.value.plays) },
  { label: "Listening time", value: formatDuration(totals.value.seconds) },
  { label: "Artists", value: formatNumber(totals.value.distinctArtists) },
  { label: "Albums", value: formatNumber(totals.value.distinctAlbums) },
  { label: "Tracks", value: formatNumber(totals.value.distinctTracks) },
] : []);
</script>

<template>
  <div class="py-2 rise">
    <h1 class="mb-1 text-3xl font-black tracking-tight">All-time</h1>
    <p class="mb-6 text-sm text-faint">Your full history, including plays from before tracking started.</p>

    <template v-if="loading">
      <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Skeleton v-for="i in 5" :key="i" class="h-[86px] rounded-xl" />
      </div>
      <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <SkeletonList :rows="8" />
        <SkeletonList :rows="8" />
      </div>
    </template>

    <template v-else>
      <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile v-for="t in tiles" :key="t.label" :label="t.label" :value="t.value" />
      </div>

      <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section>
          <div class="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Top artists</div>
          <RankedList :rows="artistRows" playable kind="artist" />
        </section>
        <section>
          <div class="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Top tracks</div>
          <RankedList :rows="trackRows" playable />
        </section>
      </div>
    </template>
  </div>
</template>
