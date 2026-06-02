<script setup lang="ts">
import { ref, computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { cleanArtist, formatNumber } from "@/lib/format";
import CoverGrid, { type CoverItem } from "@/components/CoverGrid.vue";
import SearchInput from "@/components/SearchInput.vue";
import Spinner from "@/components/ui/Spinner.vue";

const res = useRangedResource((range) => api.topAlbums({ range, limit: 200 }));
const q = ref("");
const items = computed<CoverItem[]>(() =>
  (res.data.value ?? []).map((a) => ({
    id: a.albumId, title: a.name, subtitle: cleanArtist(a.artist), value: `${formatNumber(a.plays)} plays`, coverId: a.albumId, to: `/albums/${a.albumId}`,
  })),
);
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return s ? items.value.filter((i) => i.title.toLowerCase().includes(s) || (i.subtitle ?? "").toLowerCase().includes(s)) : items.value;
});
const firstLoad = computed(() => res.loading.value && res.data.value === null);
</script>

<template>
  <div class="py-2">
    <div class="mb-7 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-3xl font-black tracking-tight">Albums</h1>
      <SearchInput v-model="q" placeholder="Search albums…" />
    </div>
    <div v-if="firstLoad" class="grid min-h-[40vh] place-items-center"><Spinner /></div>
    <CoverGrid v-else :items="filtered" />
  </div>
</template>
