<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useRangeStore } from "@/stores/range";
import { api } from "@/api/client";
import { useCoverAccent } from "@/composables/useCoverAccent";
import { formatNumber, formatDuration, formatDate, cleanArtist } from "@/lib/format";
import type { EntityDetail, RelatedTrack } from "@/api/types";
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
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

const coverId = computed(() => data.value?.coverArt ?? data.value?.id ?? null);
useCoverAccent(() => coverId.value);

const player = usePlayerStore();
const queueTracks = computed<PlayerTrack[]>(() =>
  (data.value?.related ?? []).map((r) => ({ id: r.id, title: r.title, artist: r.artist, coverId: r.hasCoverArt ? r.id : null })),
);

const noTimestamps = computed(() => !!data.value && data.value.plays > 0 && data.value.firstPlayedAt === null && data.value.lastPlayedAt === null);

const historyValues = computed(() => (data.value?.history ?? []).map((h) => h.plays));
const historyLabels = computed(() =>
  (data.value?.history ?? []).map((h) => new Date(h.day * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
);
const relatedRows = computed<RankedRow[]>(() =>
  (data.value?.related ?? []).map((r: RelatedTrack) => ({
    id: r.id, title: r.title, subtitle: cleanArtist(r.artist), value: r.plays, coverId: r.hasCoverArt ? r.id : null, to: `/tracks/${r.id}`,
  })),
);
</script>

<template>
  <div class="py-2 rise">
    <div v-if="loading" class="grid min-h-[50vh] place-items-center">
      <div class="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-[var(--accent)]" />
    </div>

    <EmptyState v-else-if="notFound || !data" title="No plays in this range"
      hint="This entity has no plays in the selected window. Switch to All to see its full history." />

    <template v-else>
      <header class="mb-8 flex flex-wrap items-end gap-5">
        <CoverArt :id="coverId" :name="data.name" :size="240" class="h-28 w-28 flex-none rounded-xl" />
        <div class="flex-1">
          <div class="text-[11px] font-bold uppercase tracking-[0.16em] text-faint">{{ kind }} · rank #{{ data.rank }}</div>
          <h1 class="text-4xl font-black tracking-tight">{{ kind === 'artist' ? cleanArtist(data.name) : data.name }}</h1>
          <div v-if="data.artist && kind !== 'artist'" class="text-sm text-muted">{{ cleanArtist(data.artist) }}</div>
        </div>
        <div v-if="queueTracks.length" class="flex gap-2">
          <button
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-[color:var(--color-bg)] transition-transform duration-150 hover:scale-[1.03] active:scale-95"
            :style="{ background: 'var(--accent)' }" @click="player.playQueue(queueTracks, 0)"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            Play
          </button>
          <button
            v-if="queueTracks.length > 1"
            class="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-text"
            @click="player.playShuffled(queueTracks)"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" />
            </svg>
            Shuffle
          </button>
          <button
            class="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-text"
            @click="player.addToQueue(queueTracks)"
          >Add to queue</button>
        </div>
      </header>

      <div class="mb-9">
        <div class="flex flex-wrap gap-8 border-y border-line/50 py-4">
          <div><div class="tabular text-2xl font-extrabold">{{ formatNumber(data.plays) }}</div><div class="text-[11px] text-faint">plays</div></div>
          <div><div class="tabular text-2xl font-extrabold">{{ formatDuration(data.seconds) }}</div><div class="text-[11px] text-faint">listening time</div></div>
          <div><div class="tabular text-2xl font-extrabold" :title="data.firstPlayedAt === null ? 'No timestamp — from baseline library history' : undefined">{{ formatDate(data.firstPlayedAt) }}</div><div class="text-[11px] text-faint">first play</div></div>
          <div><div class="tabular text-2xl font-extrabold" :title="data.lastPlayedAt === null ? 'No timestamp — from baseline library history' : undefined">{{ formatDate(data.lastPlayedAt) }}</div><div class="text-[11px] text-faint">last play</div></div>
        </div>
        <p v-if="noTimestamps" class="mt-2.5 text-xs text-faint">
          First and last play need a live or imported timestamp. This entity's plays come from your baseline library history, which has none.
        </p>
      </div>

      <section v-if="historyValues.length" class="mb-9">
        <div class="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Plays over time</div>
        <LineArea :values="historyValues" :labels="historyLabels" :height="140" zoomable />
      </section>

      <section v-if="relatedRows.length">
        <div class="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{{ kind === 'track' ? 'Related' : 'Top tracks' }}</div>
        <RankedList :rows="relatedRows" playable />
      </section>
    </template>
  </div>
</template>
