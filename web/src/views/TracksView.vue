<script setup lang="ts">
import { computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { cleanArtist } from "@/lib/format";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";

const res = useRangedResource((range) => api.topTracks({ range, limit: 200 }));
const rows = computed<RankedRow[]>(() =>
  (res.data.value ?? []).map((t) => ({
    id: t.id, title: t.title, subtitle: cleanArtist(t.artist), value: t.plays, coverId: t.hasCoverArt ? t.id : null, to: `/tracks/${t.id}`,
  })),
);
</script>

<template>
  <div class="py-2">
    <h1 class="mb-6 text-2xl font-extrabold tracking-tight">Tracks</h1>
    <RankedList :rows="rows" />
  </div>
</template>
