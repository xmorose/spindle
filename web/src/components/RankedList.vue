<script setup lang="ts">
import { ref, computed } from "vue";
import CoverArt from "./CoverArt.vue";
import NowPlayingBars from "./NowPlayingBars.vue";
import { usePlayerStore, type PlayerTrack } from "@/stores/player";
import { usePlayEntity } from "@/composables/usePlayEntity";
import { createShareLink } from "@/composables/useShare";
import { barWidth } from "@/lib/chart";

export interface RankedRow {
  id: string;
  title: string;
  subtitle?: string;
  value: number;
  valueLabel?: string;
  coverId?: string | null;
  to?: string;
  artistId?: string | null;
}

const props = withDefaults(
  defineProps<{
    rows: RankedRow[];
    playable?: boolean;
    kind?: "track" | "album" | "artist";
    emptyLabel?: string;
    rankOffset?: number;
    maxValue?: number | null;
  }>(),
  { playable: false, kind: "track", emptyLabel: "Nothing here yet.", rankOffset: 0, maxValue: null },
);

const player = usePlayerStore();
const entity = usePlayEntity();

const max = computed(() => props.maxValue ?? Math.max(...props.rows.map((r) => r.value), 1));

const trackOf = (r: RankedRow): PlayerTrack => ({ id: r.id, title: r.title, artist: r.subtitle ?? "", coverId: r.coverId ?? null, artistId: r.artistId ?? null });

const isTrack = computed(() => props.kind === "track");
function isCurrent(r: RankedRow) { return isTrack.value && player.current?.id === r.id; }
function busy(r: RankedRow) { return entity.busyId.value === r.id; }
function rankOf(i: number) { return props.rankOffset + i + 1; }
function intensity(v: number) { return v / max.value; }

const showShare = computed(() => props.kind !== "artist");
const showQueueActions = computed(() => props.kind === "track");

const openIdx = ref<number | null>(null);

function play(r: RankedRow, i: number) {
  if (props.kind === "album") { void entity.playAlbum(r.id); return; }
  if (props.kind === "artist") { void entity.playArtist(r.id); return; }
  if (isCurrent(r)) { player.toggle(); return; }
  player.playQueue(props.rows.map(trackOf), i);
}
function share(r: RankedRow) {
  openIdx.value = null;
  if (props.kind === "album") { void entity.shareAlbum(r.id, r.title); return; }
  void createShareLink({ kind: "track", trackIds: [r.id] });
}
function addQueue(r: RankedRow) { player.addToQueue([trackOf(r)]); openIdx.value = null; }
function playNextRow(r: RankedRow) { player.playNext([trackOf(r)]); openIdx.value = null; }
</script>

<template>
  <TransitionGroup v-if="rows.length" name="rank" tag="div" class="relative flex flex-col gap-px">
    <div
      v-for="(row, i) in rows"
      :key="row.id"
      class="group relative rounded-lg transition-colors"
      :class="[playable ? 'cursor-pointer' : '', isCurrent(row) ? 'bg-[var(--accent-soft)]' : '']"
      :style="{ '--i': Math.min(i, 14) }"
      @click="playable && play(row, i)"
    >
      <span
        class="rank-fill pointer-events-none absolute inset-y-0 left-0 z-0 rounded-lg"
        :style="{ width: barWidth(row.value, max), background: 'var(--accent)', opacity: 0.1 + 0.1 * intensity(row.value) }"
      />
      <span
        class="rank-edge pointer-events-none absolute inset-y-1 z-0 w-px"
        :style="{ left: barWidth(row.value, max), background: 'var(--accent)', opacity: 0.35 }"
      />

      <div class="relative z-10 flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors"
        :class="playable ? 'group-hover:bg-[oklch(0.97_0.02_80/0.05)]' : ''">
        <span
          class="tabular w-7 flex-none text-right text-[15px] font-black leading-none tracking-tight"
          :style="rankOf(i) <= 3 ? { color: 'var(--accent)' } : { color: 'var(--color-faint)' }"
        >{{ rankOf(i) }}</span>

        <button
          v-if="playable"
          class="relative h-10 w-10 flex-none"
          @click.stop="play(row, i)"
          :aria-label="isCurrent(row) && player.playing ? 'Pause' : 'Play'"
        >
          <CoverArt :id="row.coverId ?? null" :name="row.title" :size="80" class="h-10 w-10" />
          <span class="absolute inset-0 grid place-items-center rounded-lg bg-[oklch(0.12_0.02_50/0.55)] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            :class="{ '!opacity-100': busy(row) || (isCurrent(row) && player.playing) }">
            <svg v-if="busy(row)" viewBox="0 0 24 24" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-opacity="0.3" /><path d="M21 12a9 9 0 0 0-9-9" /></svg>
            <svg v-else-if="isCurrent(row) && player.playing" viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            <svg v-else viewBox="0 0 24 24" class="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </button>
        <CoverArt v-else :id="row.coverId ?? null" :name="row.title" :size="80" class="h-10 w-10 flex-none" />

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <component :is="row.to ? 'RouterLink' : 'span'" :to="row.to" @click.stop
              class="truncate text-[14px] font-semibold hover:underline"
              :style="isCurrent(row) ? { color: 'var(--accent)' } : undefined">{{ row.title }}</component>
            <NowPlayingBars v-if="isCurrent(row) && player.playing" class="flex-none text-[var(--accent)]" />
          </div>
          <RouterLink v-if="row.subtitle && row.artistId" :to="`/artists/${row.artistId}`" @click.stop
            class="block w-fit max-w-full truncate text-[11.5px] text-faint transition-colors hover:text-text hover:underline">{{ row.subtitle }}</RouterLink>
          <div v-else-if="row.subtitle" class="truncate text-[11.5px] text-faint">{{ row.subtitle }}</div>
        </div>

        <div class="flex flex-none items-center gap-1">
          <span class="tabular mr-1 text-[13px] font-bold text-text">{{ row.valueLabel ?? row.value }}</span>
          <template v-if="playable">
            <button v-if="showShare" class="rounded p-1 text-faint transition-colors hover:text-text" @click.stop="share(row)" aria-label="Share">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>
            </button>
            <button v-if="showQueueActions" class="rounded p-1 text-faint transition-colors hover:text-text" @click.stop="addQueue(row)" aria-label="Add to queue">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h11M4 12h11M4 17h7" /><path d="M19 9v8M15 13h8" /></svg>
            </button>
            <button v-if="showQueueActions" class="rounded p-1 text-faint transition-colors hover:text-text" :class="{ 'text-text': openIdx === i }" @click.stop="openIdx = openIdx === i ? null : i" aria-label="More actions">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            </button>
            <div v-if="showQueueActions && openIdx === i" class="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-xl">
              <button class="block w-full px-3 py-1.5 text-left text-[13px] font-medium hover:bg-surface-2" @click.stop="playNextRow(row)">Play next</button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </TransitionGroup>
  <div v-else class="py-10 text-center text-sm text-faint">{{ emptyLabel }}</div>
  <div v-if="openIdx !== null" class="fixed inset-0 z-10" @click="openIdx = null"></div>
</template>

<style scoped>
.rank-fill, .rank-edge { transition: width 550ms var(--ease-out-quint), left 550ms var(--ease-out-quint); }
.rank-move { transition: transform 520ms var(--ease-out-quint); }
.rank-enter-active {
  transition: opacity 380ms ease, transform 380ms var(--ease-out-quint);
  transition-delay: calc(var(--i, 0) * 28ms);
}
.rank-enter-from { opacity: 0; transform: translateY(10px); }
.rank-leave-active { position: absolute; width: 100%; transition: opacity 200ms ease; }
.rank-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .rank-fill, .rank-edge, .rank-move, .rank-enter-active, .rank-leave-active { transition: none; }
}
</style>
