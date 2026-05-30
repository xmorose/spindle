<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useRangeStore } from "@/stores/range";
import { api } from "@/api/client";
import { useCoverAccent } from "@/composables/useCoverAccent";
import { formatNumber, formatDuration, formatDate, cleanArtist } from "@/lib/format";
import type { EntityDetail, RelatedTrack } from "@/api/types";
import CoverArt from "@/components/CoverArt.vue";
import LineArea from "@/components/charts/LineArea.vue";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";
import EmptyState from "@/components/ui/EmptyState.vue";

const route = useRoute();
const { range } = storeToRefs(useRangeStore());
const kind = computed(() => String((route.meta as Record<string, unknown>).entityKind ?? "artist"));
const id = computed(() => String(route.params.id));

const data = ref<EntityDetail | null>(null);
const loading = ref(true);
const notFound = ref(false);

async function load() {
  loading.value = true; notFound.value = false;
  try {
    data.value = await api.entity(kind.value, id.value, { range: range.value });
  } catch {
    data.value = null; notFound.value = true;
  } finally {
    loading.value = false;
  }
}
watch([id, range], load, { immediate: true });

const coverId = computed(() => data.value?.id ?? null);
useCoverAccent(() => coverId.value);

const historyValues = computed(() => (data.value?.history ?? []).map((h) => h.plays));
const relatedRows = computed<RankedRow[]>(() =>
  (data.value?.related ?? []).map((r: RelatedTrack) => ({
    id: r.id, title: r.title, subtitle: cleanArtist(r.artist), value: r.plays, coverId: r.hasCoverArt ? r.id : null, to: `/tracks/${r.id}`,
  })),
);
</script>

<template>
  <div class="py-2">
    <div v-if="loading" class="grid min-h-[50vh] place-items-center">
      <div class="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-[var(--accent)]" />
    </div>

    <EmptyState v-else-if="notFound || !data" title="No plays in this range"
      hint="This entity has no plays in the selected window. Switch to All to see its full history." />

    <template v-else>
      <header class="mb-8 flex items-end gap-5">
        <CoverArt :id="coverId" :name="data.name" :size="240" class="h-28 w-28 flex-none rounded-xl" />
        <div>
          <div class="text-[11px] font-bold uppercase tracking-[0.16em] text-faint">{{ kind }} · rank #{{ data.rank }}</div>
          <h1 class="text-4xl font-black tracking-tight">{{ kind === 'artist' ? cleanArtist(data.name) : data.name }}</h1>
          <div v-if="data.artist && kind !== 'artist'" class="text-sm text-muted">{{ cleanArtist(data.artist) }}</div>
        </div>
      </header>

      <div class="mb-9 flex flex-wrap gap-8 border-y border-line/50 py-4">
        <div><div class="tabular text-2xl font-extrabold">{{ formatNumber(data.plays) }}</div><div class="text-[11px] text-faint">plays</div></div>
        <div><div class="tabular text-2xl font-extrabold">{{ formatDuration(data.seconds) }}</div><div class="text-[11px] text-faint">listening time</div></div>
        <div><div class="tabular text-2xl font-extrabold">{{ formatDate(data.firstPlayedAt) }}</div><div class="text-[11px] text-faint">first play</div></div>
        <div><div class="tabular text-2xl font-extrabold">{{ formatDate(data.lastPlayedAt) }}</div><div class="text-[11px] text-faint">last play</div></div>
      </div>

      <section v-if="historyValues.length" class="mb-9">
        <div class="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Plays over time</div>
        <LineArea :values="historyValues" :height="140" />
      </section>

      <section v-if="relatedRows.length">
        <div class="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{{ kind === 'track' ? 'Related' : 'Top tracks' }}</div>
        <RankedList :rows="relatedRows" />
      </section>
    </template>
  </div>
</template>
