<script setup lang="ts">
import { computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { cleanArtist, formatNumber } from "@/lib/format";
import CoverGrid, { type CoverItem } from "@/components/CoverGrid.vue";

const res = useRangedResource((range) => api.topAlbums({ range, limit: 200 }));
const items = computed<CoverItem[]>(() =>
  (res.data.value ?? []).map((a) => ({
    id: a.albumId, title: a.name, subtitle: cleanArtist(a.artist), value: `${formatNumber(a.plays)} plays`, coverId: a.albumId, to: `/albums/${a.albumId}`,
  })),
);
</script>

<template>
  <div class="py-2">
    <h1 class="mb-6 text-2xl font-extrabold tracking-tight">Albums</h1>
    <CoverGrid :items="items" />
  </div>
</template>
