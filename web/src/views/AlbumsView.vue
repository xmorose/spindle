<script setup lang="ts">
import { ref, computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { cleanArtist, formatNumber } from "@/lib/format";
import CoverGrid, { type CoverItem } from "@/components/CoverGrid.vue";
import { usePlayEntity } from "@/composables/usePlayEntity";
import SearchInput from "@/components/SearchInput.vue";
import SkeletonGrid from "@/components/ui/SkeletonGrid.vue";

const res = useRangedResource((p) => api.topAlbums({ ...p, limit: 200 }));
const q = ref("");
const items = computed<CoverItem[]>(() =>
  (res.data.value ?? []).map((a) => ({
    id: a.albumId, title: a.name, subtitle: cleanArtist(a.artist), value: `${formatNumber(a.plays)} ${a.plays === 1 ? "play" : "plays"}`, coverId: a.albumId, to: `/albums/${a.albumId}`, artistId: a.artistId,
  })),
);
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return s ? items.value.filter((i) => i.title.toLowerCase().includes(s) || (i.subtitle ?? "").toLowerCase().includes(s)) : items.value;
});
const firstLoad = computed(() => res.loading.value && res.data.value === null);
const { playAlbum, shareAlbum, busyId } = usePlayEntity();
</script>

<template>
  <div class="py-2">
    <div class="mb-7 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-3xl font-black tracking-tight">Albums</h1>
      <SearchInput v-model="q" placeholder="Search albums…" />
    </div>
    <SkeletonGrid v-if="firstLoad" />
    <CoverGrid v-else :items="filtered" playable shareable :busy-id="busyId"
      @play="(it) => playAlbum(it.id)" @share="(it) => shareAlbum(it.id, it.title)" />
  </div>
</template>
