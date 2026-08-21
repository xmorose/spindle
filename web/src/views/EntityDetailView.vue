<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useRangeStore } from "@/stores/range";
import { useUserStore } from "@/stores/user";
import { api } from "@/api/client";
import { useCoverAccent } from "@/composables/useCoverAccent";
import { formatNumber, formatDuration, formatDate, cleanArtist } from "@/lib/format";
import type { EntityDetail, RelatedTrack } from "@/api/types";
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
import { createShareLink } from "@/composables/useShare";
import CoverArt from "@/components/CoverArt.vue";
import LineArea from "@/components/charts/LineArea.vue";
import RankedList, { type RankedRow } from "@/components/RankedList.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import SkeletonList from "@/components/ui/SkeletonList.vue";

const route = useRoute();
const { params } = storeToRefs(useRangeStore());
const { user } = storeToRefs(useUserStore());
const kind = computed(() => String((route.meta as Record<string, unknown>).entityKind ?? "artist"));
const id = computed(() => String(route.params.id));

const data = ref<EntityDetail | null>(null);
const loading = ref(true);
const notFound = ref(false);

async function load() {
  loading.value = true; notFound.value = false;
  try {
    data.value = await api.entity(kind.value, id.value, { ...params.value });
  } catch {
    data.value = null; notFound.value = true;
  } finally {
    loading.value = false;
  }
}
watch([id, params, user], load, { immediate: true });

const coverId = computed(() => data.value?.coverArt ?? data.value?.id ?? null);
useCoverAccent(() => coverId.value);

const player = usePlayerStore();
const queueTracks = computed<PlayerTrack[]>(() =>
  (data.value?.related ?? []).map((r) => ({ id: r.id, title: r.title, artist: r.artist, coverId: r.hasCoverArt ? r.id : null })),
);

const canShare = computed(() => kind.value === "track" || (kind.value === "album" && queueTracks.value.length > 0));
function shareEntity() {
  if (kind.value === "track") {
    void createShareLink({ kind: "track", trackIds: [id.value] });
  } else if (kind.value === "album") {
    void createShareLink({ kind: "album", trackIds: queueTracks.value.map((t) => t.id), label: data.value?.name });
  }
}

const noTimestamps = computed(() => !!data.value && data.value.plays > 0 && data.value.firstPlayedAt === null && data.value.lastPlayedAt === null);

const historyValues = computed(() => (data.value?.history ?? []).map((h) => h.plays));
const historyLabels = computed(() =>
  (data.value?.history ?? []).map((h) => new Date(h.day * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
);
const relatedRows = computed<RankedRow[]>(() =>
  (data.value?.related ?? []).map((r: RelatedTrack) => ({
    id: r.id, title: r.title, subtitle: cleanArtist(r.artist), value: r.plays, coverId: r.hasCoverArt ? r.id : null, to: `/tracks/${r.id}`, artistId: r.artistId,
  })),
);
</script>

<template>
  <div class="py-2 rise">
    <div v-if="loading">
      <div class="mb-8 flex flex-wrap items-end gap-5">
        <Skeleton class="h-28 w-28 rounded-xl" />
        <div class="flex-1">
          <Skeleton class="h-2.5 w-16" />
          <Skeleton class="mt-2.5 h-8 w-72 max-w-full" />
          <Skeleton class="mt-2.5 h-3 w-40 max-w-full" />
        </div>
      </div>
      <div class="mb-9 flex flex-wrap items-end gap-x-10 gap-y-6 border-y border-line/50 py-5">
        <div>
          <Skeleton class="h-9 w-28" />
          <Skeleton class="mt-2.5 h-2.5 w-14" />
        </div>
        <div>
          <Skeleton class="h-6 w-20" />
          <Skeleton class="mt-2.5 h-2.5 w-24" />
        </div>
        <div v-for="i in 2" :key="i">
          <Skeleton class="h-4 w-24" />
          <Skeleton class="mt-2.5 h-2.5 w-16" />
        </div>
      </div>
      <SkeletonList :rows="6" />
    </div>

    <EmptyState v-else-if="notFound || !data" title="Not found"
      hint="We couldn't find this in your library." />

    <template v-else>
      <header class="mb-8 flex flex-wrap items-end gap-5">
        <button v-if="queueTracks.length" class="group relative h-28 w-28 flex-none" @click="player.playQueue(queueTracks, 0)" aria-label="Play">
          <CoverArt :id="coverId" :name="data.name" :size="240" class="h-28 w-28 rounded-xl" />
          <span class="absolute inset-0 grid place-items-center rounded-xl bg-[oklch(0.12_0.02_50/0.55)] text-white opacity-0 transition-opacity group-hover:opacity-100">
            <svg viewBox="0 0 24 24" class="h-9 w-9 translate-x-px" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </button>
        <CoverArt v-else :id="coverId" :name="data.name" :size="240" class="h-28 w-28 flex-none rounded-xl" />
        <div class="flex-1">
          <div class="label-sm">{{ kind }}<span v-if="data.rank > 0"> · rank #{{ data.rank }}</span></div>
          <h1 class="text-4xl font-black tracking-tight">{{ kind === 'artist' ? cleanArtist(data.name) : data.name }}</h1>
          <RouterLink v-if="data.artist && kind !== 'artist' && data.artistId" :to="`/artists/${data.artistId}`"
            class="text-sm text-muted transition-colors hover:text-text hover:underline">{{ cleanArtist(data.artist) }}</RouterLink>
          <div v-else-if="data.artist && kind !== 'artist'" class="text-sm text-muted">{{ cleanArtist(data.artist) }}</div>
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
          <button
            v-if="canShare"
            class="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-text"
            @click="shareEntity"
          >Share</button>
        </div>
      </header>

      <div class="mb-9">
        <div class="flex flex-wrap items-end gap-x-10 gap-y-6 border-y border-line/50 py-5">
          <div class="flex-none">
            <div class="tabular text-4xl font-black leading-none tracking-tight" :style="{ color: 'var(--accent)' }">{{ formatNumber(data.plays) }}</div>
            <div class="label-sm mt-2">Plays</div>
          </div>
          <div class="flex-none">
            <div class="tabular text-2xl font-black leading-none tracking-tight">{{ formatDuration(data.seconds) }}</div>
            <div class="label-sm mt-2">Listening time</div>
          </div>
          <div class="flex gap-10 sm:border-l sm:border-line/60 sm:pl-10">
            <div>
              <div class="tabular text-base font-bold leading-none" :title="data.firstPlayedAt === null ? 'No timestamp. This comes from your baseline library history.' : undefined">{{ formatDate(data.firstPlayedAt) }}</div>
              <div class="label-sm mt-2">First play</div>
            </div>
            <div>
              <div class="tabular text-base font-bold leading-none" :title="data.lastPlayedAt === null ? 'No timestamp. This comes from your baseline library history.' : undefined">{{ formatDate(data.lastPlayedAt) }}</div>
              <div class="label-sm mt-2">Last play</div>
            </div>
          </div>
        </div>

        <p v-if="noTimestamps" class="mt-2.5 text-xs text-faint">
          First and last play need a live or imported timestamp. This entity's plays come from your baseline library history, which has none.
        </p>
      </div>

      <section v-if="historyValues.length" class="mb-9">
        <div class="mb-3 label-sm">Plays over time</div>
        <LineArea :values="historyValues" :labels="historyLabels" :height="140" zoomable />
      </section>

      <section v-if="relatedRows.length">
        <div class="mb-3 label-sm">{{ kind === 'track' ? 'Related' : 'Tracks' }}</div>
        <RankedList :rows="relatedRows" playable />
      </section>
    </template>
  </div>
</template>
