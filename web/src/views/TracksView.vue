<script setup lang="ts">
import { ref, computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { cleanArtist } from "@/lib/format";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";
import ListActionBar from "@/components/ListActionBar.vue";
import SearchInput from "@/components/SearchInput.vue";
import SkeletonList from "@/components/ui/SkeletonList.vue";
import type { PlayerTrack } from "@/stores/player";

const res = useRangedResource((p) => api.topTracks({ ...p, limit: 200 }));
const q = ref("");
const rows = computed<RankedRow[]>(() =>
  (res.data.value ?? []).map((t) => ({
    id: t.id, title: t.title, subtitle: cleanArtist(t.artist), value: t.plays, coverId: t.hasCoverArt ? t.id : null, to: `/tracks/${t.id}`, artistId: t.artistId,
  })),
);
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return s ? rows.value.filter((r) => r.title.toLowerCase().includes(s) || (r.subtitle ?? "").toLowerCase().includes(s)) : rows.value;
});
const firstLoad = computed(() => res.loading.value && res.data.value === null);
const trackList = computed<PlayerTrack[]>(() =>
  filtered.value.map((r) => ({ id: r.id, title: r.title, artist: r.subtitle ?? "", coverId: r.coverId ?? null })),
);
</script>

<template>
  <div class="py-2">
    <div class="mb-7 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-3xl font-black tracking-tight">Tracks</h1>
      <SearchInput v-model="q" placeholder="Search tracks…" />
    </div>
    <SkeletonList v-if="firstLoad" :rows="12" />
    <template v-else>
      <ListActionBar :tracks="trackList" :count="filtered.length" />
      <RankedList :rows="filtered" playable />
    </template>
  </div>
</template>
