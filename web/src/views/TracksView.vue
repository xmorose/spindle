<script setup lang="ts">
import { ref, computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { cleanArtist } from "@/lib/format";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";
import SearchInput from "@/components/SearchInput.vue";
import Spinner from "@/components/ui/Spinner.vue";

const res = useRangedResource((range) => api.topTracks({ range, limit: 200 }));
const q = ref("");
const rows = computed<RankedRow[]>(() =>
  (res.data.value ?? []).map((t) => ({
    id: t.id, title: t.title, subtitle: cleanArtist(t.artist), value: t.plays, coverId: t.hasCoverArt ? t.id : null, to: `/tracks/${t.id}`,
  })),
);
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return s ? rows.value.filter((r) => r.title.toLowerCase().includes(s) || (r.subtitle ?? "").toLowerCase().includes(s)) : rows.value;
});
const firstLoad = computed(() => res.loading.value && res.data.value === null);
</script>

<template>
  <div class="py-2">
    <div class="mb-7 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-extrabold tracking-tight">Tracks</h1>
      <SearchInput v-model="q" placeholder="Search tracks…" />
    </div>
    <div v-if="firstLoad" class="grid min-h-[40vh] place-items-center"><Spinner /></div>
    <RankedList v-else :rows="filtered" />
  </div>
</template>
