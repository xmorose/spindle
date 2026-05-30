<script setup lang="ts">
import { computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { cleanArtist, formatNumber } from "@/lib/format";
import CoverGrid, { type CoverItem } from "@/components/CoverGrid.vue";

const res = useRangedResource((range) => api.topArtists({ range, limit: 200 }));
const items = computed<CoverItem[]>(() =>
  (res.data.value ?? []).map((a) => ({
    id: a.artistId, title: cleanArtist(a.name), value: `${formatNumber(a.plays)} plays`, coverId: a.artistId, to: `/artists/${a.artistId}`,
  })),
);
</script>

<template>
  <div class="py-2">
    <h1 class="mb-6 text-2xl font-extrabold tracking-tight">Artists</h1>
    <CoverGrid :items="items" />
  </div>
</template>
