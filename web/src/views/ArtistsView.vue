<script setup lang="ts">
import { ref, computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { cleanArtist, formatNumber } from "@/lib/format";
import CoverGrid, { type CoverItem } from "@/components/CoverGrid.vue";
import SearchInput from "@/components/SearchInput.vue";
import Spinner from "@/components/ui/Spinner.vue";

const res = useRangedResource((range) => api.topArtists({ range, limit: 200 }));
const q = ref("");
const items = computed<CoverItem[]>(() =>
  (res.data.value ?? []).map((a) => ({
    id: a.artistId, title: cleanArtist(a.name), value: `${formatNumber(a.plays)} plays`, coverId: a.coverArt, to: `/artists/${a.artistId}`,
  })),
);
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return s ? items.value.filter((i) => i.title.toLowerCase().includes(s)) : items.value;
});
const firstLoad = computed(() => res.loading.value && res.data.value === null);
</script>

<template>
  <div class="py-2">
    <div class="mb-7 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-extrabold tracking-tight">Artists</h1>
      <SearchInput v-model="q" placeholder="Search artists…" />
    </div>
    <div v-if="firstLoad" class="grid min-h-[40vh] place-items-center"><Spinner /></div>
    <CoverGrid v-else :items="filtered" />
  </div>
</template>
