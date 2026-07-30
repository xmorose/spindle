<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { api, coverUrl } from "@/api/client";
import { useUserStore } from "@/stores/user";
import { usePlayerStore } from "@/stores/player";
import { useCoverAccent } from "@/composables/useCoverAccent";
import { formatNumber, formatDuration, cleanArtist, NO_VALUE } from "@/lib/format";
import { hourlyFromHeatmap, peakHour } from "@/lib/stats";
import { renderWrappedCard, downloadCard } from "@/lib/wrapped-card";
import type { Totals, ArtistTop, TrackTop, GenreTop, TimePoint, Session, EntityDetail } from "@/api/types";
import CoverArt from "@/components/CoverArt.vue";
import CoverBackdrop from "@/components/CoverBackdrop.vue";
import VinylHero from "@/components/VinylHero.vue";
import RadialClock from "@/components/charts/RadialClock.vue";
import LineArea from "@/components/charts/LineArea.vue";
import Odometer from "@/components/ui/Odometer.vue";

const router = useRouter();
const player = usePlayerStore();

const year = new Date().getFullYear();
const yearStart = Math.floor(new Date(year, 0, 1).getTime() / 1000);
const nowTs = Math.floor(Date.now() / 1000);
const P = { from: yearStart, to: nowTs };
const curMonth = new Date().getMonth();

const totals = ref<Totals | null>(null);
const artists = ref<ArtistTop[]>([]);
const tracks = ref<TrackTop[]>([]);
const genres = ref<GenreTop[]>([]);
const days = ref<TimePoint[]>([]);
const hourly = ref<number[]>([]);
const longest = ref<Session | null>(null);
const monthTops = ref<(ArtistTop | null)[]>([]);
const mosaic = ref<string[]>([]);
const bigDayCovers = ref<string[]>([]);
const details = ref<Record<string, EntityDetail>>({});
const loading = ref(true);
const { user } = storeToRefs(useUserStore());

async function load() {
  loading.value = true;
  const monthRanges = Array.from({ length: curMonth + 1 }, (_, m) => ({
    from: Math.floor(new Date(year, m, 1).getTime() / 1000),
    to: Math.min(Math.floor(new Date(year, m + 1, 1).getTime() / 1000), nowTs),
  }));
  const [t, ar, tr, ge, ds, heat, se, al, ...months] = await Promise.all([
    api.totals(P),
    api.topArtists({ ...P, limit: 5 }),
    api.topTracks({ ...P, limit: 5 }),
    api.topGenres({ ...P, limit: 6 }),
    api.timeseries({ ...P, bucket: "day" }),
    api.heatmap(P),
    api.sessions({ ...P, sort: "time", limit: 1 }),
    api.topAlbums({ ...P, limit: 48 }),
    ...monthRanges.map((r) => api.topArtists({ ...r, limit: 1 })),
  ]);
  totals.value = t; artists.value = ar; tracks.value = tr; genres.value = ge; days.value = ds;
  hourly.value = hourlyFromHeatmap(heat);
  longest.value = se[0] ?? null;
  monthTops.value = months.map((m) => m[0] ?? null);
  mosaic.value = al.map((a) => a.albumId);
  loading.value = false;
  card.value = null;
  cardUrl.value = "";
  activeCover.value = heroCover.value;
  void loadBiggestDayArt();
  void loadArtistDetails();
  void nextTick(observeChapters);
}

async function loadArtistDetails() {
  details.value = {};
  const out: Record<string, EntityDetail> = {};
  await Promise.all(
    artists.value.map(async (a) => {
      try { out[a.artistId] = await api.entity("artist", a.artistId, P); } catch {}
    }),
  );
  details.value = out;
}
watch(user, load, { immediate: true });

const isEmpty = computed(() => !loading.value && (totals.value?.plays ?? 0) === 0);
const topArtist = computed(() => artists.value[0] ?? null);
const topTrack = computed(() => tracks.value[0] ?? null);
const heroCover = computed(() => (topTrack.value?.hasCoverArt ? topTrack.value.id : null) ?? topArtist.value?.coverArt ?? null);

const activeCover = ref<string | null>(null);
useCoverAccent(() => activeCover.value);

const monthPlays = computed(() => {
  const out = Array.from({ length: curMonth + 1 }, () => 0);
  for (const p of days.value) {
    const d = new Date(p.bucket * 86_400_000);
    if (d.getUTCFullYear() === year && d.getUTCMonth() <= curMonth) out[d.getUTCMonth()] += p.plays;
  }
  return out;
});
const monthMax = computed(() => Math.max(1, ...monthPlays.value));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthCells = computed(() =>
  MONTHS.map((name, m) => ({
    name,
    future: m > curMonth,
    plays: monthPlays.value[m] ?? 0,
    artist: monthTops.value[m] ?? null,
  })),
);
const loudestMonth = computed(() => {
  const i = monthPlays.value.indexOf(monthMax.value);
  return i < 0 || !monthTops.value[i] ? null : { name: MONTHS[i], artist: monthTops.value[i]! };
});

const biggestDay = computed(() => {
  let best: TimePoint | null = null;
  for (const p of days.value) if (!best || p.plays > best.plays) best = p;
  if (!best || best.plays === 0) return null;
  const ms = best.bucket * 86_400_000;
  return {
    label: new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }),
    plays: best.plays,
    from: Math.floor(ms / 1000),
    to: Math.floor(ms / 1000) + 86_400,
  };
});

async function loadBiggestDayArt() {
  bigDayCovers.value = [];
  const d = biggestDay.value;
  if (!d) return;
  try {
    const top = await api.topTracks({ from: d.from, to: d.to, limit: 3 });
    bigDayCovers.value = top.filter((t) => t.hasCoverArt).map((t) => t.id);
  } catch {
    bigDayCovers.value = [];
  }
}

const sessionCovers = computed(() =>
  (longest.value?.tracks ?? []).filter((t) => t.hasCoverArt).slice(0, 3).map((t) => t.id),
);
const peak = computed(() => (hourly.value.some((v) => v > 0) ? peakHour(hourly.value) : null));
const topGenre = computed(() => genres.value[0]?.genre ?? null);
const longestLabel = computed(() => {
  if (!longest.value) return null;
  const d = new Date(longest.value.startedAt * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return { dur: formatDuration(longest.value.seconds), tracks: longest.value.trackCount, date: d };
});

const countdown = computed(() => artists.value.slice().reverse());
const COUNT_BASE = 5;
const countIdx = ref(0);
const countActive = computed(() => countdown.value[Math.min(countIdx.value, countdown.value.length - 1)] ?? null);
const countRank = computed(() => countdown.value.length - Math.min(countIdx.value, countdown.value.length - 1));
const countEl = ref<HTMLElement | null>(null);
watch(() => countActive.value?.coverArt ?? null, (c) => { if (c) activeCover.value = c; });
const finaleIdx = computed(() => COUNT_BASE + 1);
const chapterCount = computed(() => COUNT_BASE + Math.max(1, countdown.value.length) + 1);

const yearValues = computed(() => days.value.map((p) => p.plays));
const yearLabels = computed(() =>
  days.value.map((p) => new Date(p.bucket * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })),
);

const scrollEl = ref<HTMLElement | null>(null);
const active = ref(0);
let observer: IntersectionObserver | null = null;

const reduceMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let parallaxRaf = 0;
function updateParallax() {
  parallaxRaf = 0;
  const root = scrollEl.value;
  if (!root) return;
  const h = root.clientHeight || 1;
  if (!reduceMotion) {
    for (const el of root.querySelectorAll<HTMLElement>("[data-chapter]")) {
      const r = el.getBoundingClientRect();
      const p = (r.top + r.height / 2 - h / 2) / h;
      el.style.setProperty("--p", String(Math.max(-1.5, Math.min(1.5, p)).toFixed(3)));
    }
  }
  const c = countEl.value;
  if (c && countdown.value.length) {
    const top = c.getBoundingClientRect().top;
    const step = Math.floor((-top + h * 0.5) / h);
    countIdx.value = Math.max(0, Math.min(countdown.value.length - 1, step));
  }
}
function onScroll() {
  updateActiveDot();
  if (parallaxRaf) return;
  parallaxRaf = requestAnimationFrame(updateParallax);
}
function updateActiveDot() {
  const root = scrollEl.value;
  if (!root) return;
  const h = root.clientHeight || 1;
  const c = countEl.value;
  if (c) {
    const top = c.getBoundingClientRect().top;
    if (top <= h * 0.5 && top + c.offsetHeight > h * 0.5) {
      active.value = COUNT_BASE + Math.max(0, Math.min(countdown.value.length - 1, Math.floor((-top + h * 0.5) / h)));
      return;
    }
    if (top + c.offsetHeight <= h * 0.5) {
      active.value = COUNT_BASE + Math.max(1, countdown.value.length);
      return;
    }
  }
  active.value = Math.max(0, Math.min(COUNT_BASE - 1, Math.round(root.scrollTop / h)));
}

onMounted(() => {
  void useUserStore().init();
  if (!loading.value) void nextTick(observeChapters);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  if (parallaxRaf) cancelAnimationFrame(parallaxRaf);
});

function observeChapters() {
  observer?.disconnect();
  if (!scrollEl.value) return;
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      el.classList.add("seen");
      const cover = el.dataset.cover;
      if (cover !== undefined) activeCover.value = cover || null;
      if (el.dataset.finale !== undefined) void makeCard();
    }
  }, { root: scrollEl.value, threshold: 0.4 });
  for (const s of scrollEl.value.querySelectorAll<HTMLElement>("[data-chapter]")) observer.observe(s);
  updateParallax();
  updateActiveDot();
}

function goTo(i: number) {
  const root = scrollEl.value;
  if (!root) return;
  const h = root.clientHeight || 1;
  const n = Math.max(1, countdown.value.length);
  if (i >= COUNT_BASE && i < COUNT_BASE + n && countEl.value) {
    root.scrollTo({ top: countEl.value.offsetTop + (i - COUNT_BASE) * h, behavior: "smooth" });
    return;
  }
  if (i >= COUNT_BASE + n) {
    root.querySelector<HTMLElement>("[data-finale]")?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  root.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ behavior: "smooth" });
}
function shareOfYear(plays: number): string {
  const total = totals.value?.plays ?? 0;
  if (!total) return "";
  const pct = (plays / total) * 100;
  return pct >= 1 ? `${pct.toFixed(1)}%` : `${pct.toFixed(2)}%`;
}
function runOfListening(d: EntityDetail | undefined): string | null {
  if (!d || d.firstPlayedAt === null || d.lastPlayedAt === null) return null;
  const f = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(d.firstPlayedAt)} → ${f(d.lastPlayedAt)}`;
}
function playArtistTrack(artistId: string, i: number) {
  const rel = details.value[artistId]?.related ?? [];
  if (!rel.length) return;
  player.playQueue(
    rel.map((r) => ({ id: r.id, title: r.title, artist: r.artist, coverId: r.hasCoverArt ? r.id : null, artistId: r.artistId })),
    i,
  );
}
function playYear() {
  if (!tracks.value.length) return;
  player.playQueue(
    tracks.value.map((t) => ({ id: t.id, title: t.title, artist: t.artist, coverId: t.hasCoverArt ? t.id : null, artistId: t.artistId })),
    0,
  );
}

const card = ref<HTMLCanvasElement | null>(null);
const cardUrl = ref("");
const rendering = ref(false);
async function makeCard() {
  if (card.value || rendering.value || !totals.value) return;
  rendering.value = true;
  try {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "oklch(0.79 0.15 55)";
    const cover = topArtist.value?.coverArt ?? (topTrack.value?.hasCoverArt ? topTrack.value.id : null);
    card.value = await renderWrappedCard({
      year,
      plays: totals.value.plays,
      seconds: totals.value.seconds,
      distinctArtists: totals.value.distinctArtists,
      topArtist: topArtist.value ? cleanArtist(topArtist.value.name) : NO_VALUE,
      coverUrl: cover ? coverUrl(cover, 600) : null,
      tracks: tracks.value.map((t) => ({ title: t.title, artist: cleanArtist(t.artist), plays: t.plays })),
      genre: topGenre.value,
      accent,
    });
    cardUrl.value = card.value.toDataURL("image/png");
  } finally {
    rendering.value = false;
  }
}
async function download() {
  if (!card.value) await makeCard();
  if (card.value) downloadCard(card.value, year);
}
</script>

<template>
  <div class="fixed inset-0 bg-bg text-text">
    <div v-if="loading" class="grid h-full place-items-center">
      <div class="text-center">
        <div class="label" style="letter-spacing:0.14em">{{ year }}</div>
        <div class="mt-4 text-sm text-faint">Counting your year…</div>
      </div>
    </div>

    <div v-else-if="isEmpty" class="grid h-full place-items-center px-6 text-center">
      <div>
        <h1 class="text-3xl font-black tracking-tight">Wrapped</h1>
        <p class="mx-auto mt-3 max-w-[42ch] text-sm text-muted">Not enough listening this year yet. Your year in review fills in as Spindle tracks more plays.</p>
        <button class="mt-7 rounded-full border border-line px-5 py-2 text-sm font-semibold text-muted transition-colors hover:text-text" @click="router.push('/')">Back to Spindle</button>
      </div>
    </div>

    <template v-else>
      <button
        class="fixed right-5 top-5 z-30 grid h-10 w-10 place-items-center rounded-full border border-[oklch(0.97_0.02_80/0.25)] bg-[oklch(0.12_0.02_50/0.45)] text-white backdrop-blur transition-colors hover:bg-[oklch(0.12_0.02_50/0.75)]"
        aria-label="Close Wrapped" @click="router.push('/')">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      <nav class="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 sm:flex" aria-label="Chapters">
        <button v-for="i in chapterCount" :key="i" class="h-2 w-2 rounded-full transition-all duration-300"
          :style="active === i - 1
            ? { background: 'var(--accent)', transform: 'scale(1.6)' }
            : { background: 'oklch(0.97 0.02 80 / 0.28)' }"
          :aria-label="`Chapter ${i}`" @click="goTo(i - 1)" />
      </nav>

      <div ref="scrollEl" class="h-full snap-y snap-mandatory overflow-y-auto overflow-x-hidden" @scroll.passive="onScroll">
        <section data-chapter data-idx="0" :data-cover="heroCover ?? ''"
          class="ch seen relative flex h-dvh snap-start items-center justify-center overflow-hidden">
          <div class="mosaic absolute inset-0" aria-hidden="true">
            <div class="mosaic-grid">
              <img v-for="(id, i) in mosaic" :key="id + i" :src="coverUrl(id, 200)" alt="" loading="lazy" class="h-full w-full object-cover" />
            </div>
          </div>
          <div class="absolute inset-0" style="background:radial-gradient(ellipse at center, oklch(0.14 0.02 50 / 0.62) 0%, oklch(0.13 0.02 50 / 0.9) 70%)" />
          <div class="intro-wash absolute inset-0" aria-hidden="true" />
          <div class="drift relative px-6 text-center">
            <div class="label" style="letter-spacing:0.2em">{{ year }}</div>
            <h1 class="mt-5 text-[clamp(2.5rem,7vw,5.5rem)] font-black leading-[0.95] tracking-tight">Your year in sound</h1>
            <p class="mx-auto mt-5 max-w-[38ch] text-sm text-muted sm:text-base">Twelve months, {{ formatNumber(totals?.distinctArtists ?? 0) }} artists, and one of them mattered more than the rest.</p>
            <div class="scroll-cue mt-16 inline-flex flex-col items-center gap-2 text-xs font-semibold text-faint">
              <span>scroll</span>
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
            </div>
          </div>
        </section>

        <section data-chapter data-idx="1" :data-cover="heroCover ?? ''"
          class="ch relative flex h-dvh snap-start flex-col justify-center overflow-hidden">
          <CoverBackdrop :id="heroCover" :tint="0.68" />
          <div class="drift relative">
            <div class="px-6 sm:px-12">
              <div class="label">The year, day by day</div>
              <div v-if="biggestDay" class="mt-3 text-[clamp(1.5rem,4vw,3rem)] font-black leading-tight tracking-tight">
                It peaked on <span :style="{ color: 'var(--accent)' }">{{ biggestDay.label }}</span>
              </div>
            </div>
            <div class="year-line mt-10 w-full">
              <LineArea :values="yearValues" :labels="yearLabels" :height="260" />
            </div>
            <div class="mt-4 flex justify-between px-6 text-[11px] font-semibold uppercase tracking-wider text-faint sm:px-12">
              <span>{{ yearLabels[0] }}</span>
              <span class="tabular">{{ formatNumber(totals?.plays ?? 0) }} plays across {{ yearValues.length }} days</span>
              <span>{{ yearLabels[yearLabels.length - 1] }}</span>
            </div>
          </div>
        </section>

        <section data-chapter data-idx="2" :data-cover="loudestMonth?.artist.coverArt ?? heroCover ?? ''"
          class="ch relative flex h-dvh snap-start flex-col justify-center overflow-hidden px-6 py-16 sm:px-12">
          <CoverBackdrop :id="loudestMonth?.artist.coverArt ?? heroCover" :tint="0.62" />
          <div class="drift relative">
          <div class="label mb-8">Month by month</div>
          <div class="grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:gap-3">
            <div v-for="(c, m) in monthCells" :key="m"
              class="tile group relative aspect-square overflow-hidden rounded-xl"
              :style="{ animationDelay: `${m * 0.04}s` }"
              :title="c.future ? `${c.name} — still to come` : `${c.name} · ${formatNumber(c.plays)} ${c.plays === 1 ? 'play' : 'plays'}${c.artist ? ' · ' + cleanArtist(c.artist.name) : ''}`">
              <template v-if="c.future">
                <div class="absolute inset-0 rounded-xl border border-dashed border-line/70" />
                <div class="absolute inset-x-0 bottom-0 p-2.5">
                  <div class="text-[11px] font-black uppercase tracking-wider text-faint/60">{{ c.name.slice(0, 3) }}</div>
                </div>
              </template>
              <template v-else>
                <CoverArt v-if="c.artist?.coverArt" :id="c.artist.coverArt" :name="cleanArtist(c.artist.name)" :size="300"
                  class="absolute inset-0 h-full w-full transition-transform duration-500 ease-out group-hover:scale-105"
                  :style="{ opacity: 0.72 + 0.28 * (c.plays / monthMax) }" />
                <div v-else class="absolute inset-0 bg-surface" />
                <div class="absolute inset-0" style="background:linear-gradient(180deg,transparent 40%,oklch(0.12 0.02 50 / 0.9) 100%)" />
                <div v-if="c.plays === monthMax" class="absolute inset-0 rounded-xl" :style="{ boxShadow: 'inset 0 0 0 2px var(--accent)' }" />
                <div class="absolute inset-x-0 bottom-0 p-2.5">
                  <div class="text-[11px] font-black uppercase tracking-wider text-white">{{ c.name.slice(0, 3) }}</div>
                  <div class="tabular text-[10px] font-semibold" style="color:oklch(0.97 0.02 80 / 0.75)">{{ formatNumber(c.plays) }}</div>
                </div>
              </template>
            </div>
          </div>
          <div v-if="loudestMonth" class="mt-8 text-sm text-muted">
            <span class="text-faint">Loudest month:</span>
            <span class="font-semibold text-text"> {{ loudestMonth.name }}</span>
            <span class="text-faint"> with </span>
            <span class="font-semibold text-text">{{ cleanArtist(loudestMonth.artist.name) }}</span>
          </div>
          </div>
        </section>

        <section data-chapter data-idx="3" :data-cover="heroCover ?? ''"
          class="ch relative flex h-dvh snap-start items-center overflow-hidden px-6 sm:px-12">
          <CoverBackdrop :id="heroCover" :tint="0.66" />
          <div class="drift relative grid w-full items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
            <div class="min-w-0">
              <div class="label">Your listening clock</div>
              <div v-if="peak !== null" class="tabular mt-3 text-[clamp(3.5rem,11vw,8rem)] font-black leading-[0.85] tracking-tight"
                :style="{ color: 'var(--accent)' }">{{ String(peak).padStart(2, '0') }}:00</div>
              <p class="mt-4 max-w-[36ch] text-sm text-muted sm:text-base">
                Every hour of the day, sized by how much you played in it. Yours peaks
                {{ peak !== null && peak >= 5 && peak < 12 ? 'in the morning' : peak !== null && peak < 17 ? 'in the afternoon' : peak !== null && peak < 22 ? 'in the evening' : 'late' }}.
              </p>
            </div>
            <div class="clock-big mx-auto w-[min(74vw,54vh)] flex-none">
              <RadialClock :hours="hourly" :stagger="0.055" :label-step="3" :peak="peak" class="w-full" />
            </div>
          </div>
        </section>

        <section data-chapter data-idx="4" :data-cover="heroCover ?? ''"
          class="ch relative flex h-dvh snap-start flex-col justify-center overflow-hidden px-6 sm:px-12">
          <CoverBackdrop :id="heroCover" :tint="0.58" />
          <div class="drift relative w-full">
            <div class="label mb-8">For the record</div>
            <div class="flex flex-col">
              <div v-if="biggestDay" class="record-row flex flex-wrap items-center justify-between gap-6 border-t border-line/50 py-7">
                <div class="min-w-0">
                  <div class="label">Biggest day</div>
                  <div class="mt-2 text-[clamp(2rem,6vw,4.5rem)] font-black leading-[0.95] tracking-tight" :style="{ color: 'var(--accent)' }">{{ biggestDay.label }}</div>
                  <div class="tabular mt-2 text-sm font-semibold text-muted">{{ formatNumber(biggestDay.plays) }} plays in a single day</div>
                </div>
                <div class="flex flex-none -space-x-5">
                  <CoverArt v-for="id in bigDayCovers" :key="id" :id="id" :size="300"
                    class="h-24 w-24 flex-none rounded-xl ring-2 ring-[oklch(0.13_0.02_50/0.75)] sm:h-28 sm:w-28" />
                </div>
              </div>
              <div v-if="longestLabel" class="record-row flex flex-wrap items-center justify-between gap-6 border-t border-line/50 py-7">
                <div class="min-w-0">
                  <div class="label">Longest session</div>
                  <div class="tabular mt-2 text-[clamp(2rem,6vw,4.5rem)] font-black leading-[0.95] tracking-tight">{{ longestLabel.dur }}</div>
                  <div class="mt-2 text-sm text-muted">{{ longestLabel.tracks }} {{ longestLabel.tracks === 1 ? 'track' : 'tracks' }} straight on {{ longestLabel.date }}</div>
                </div>
                <div class="flex flex-none -space-x-5">
                  <CoverArt v-for="id in sessionCovers" :key="id" :id="id" :size="300"
                    class="h-24 w-24 flex-none rounded-xl ring-2 ring-[oklch(0.13_0.02_50/0.75)] sm:h-28 sm:w-28" />
                </div>
              </div>
              <div v-if="totals" class="record-row flex flex-wrap items-center justify-between gap-6 border-t border-b border-line/50 py-7">
                <div class="min-w-0">
                  <div class="label">Busiest habit</div>
                  <div class="tabular mt-2 text-[clamp(2rem,6vw,4.5rem)] font-black leading-[0.95] tracking-tight">{{ totals.avgPlaysPerActiveDay.toFixed(1) }}</div>
                  <div class="mt-2 text-sm text-muted">songs on an average day you listened</div>
                </div>
                <div class="tabular text-right text-sm text-muted">
                  <div><span class="font-black text-text">{{ formatNumber(totals.distinctTracks) }}</span> different tracks</div>
                  <div class="mt-1"><span class="font-black text-text">{{ formatNumber(totals.distinctAlbums) }}</span> albums</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="countActive" ref="countEl" class="relative"
          :style="{ height: countdown.length * 100 + 'dvh' }">
          <div v-for="(a, i) in countdown" :key="'snap-' + a.artistId"
            class="pointer-events-none absolute left-0 w-px snap-start"
            :style="{ top: i * 100 + 'dvh', height: '100dvh' }" />

          <div data-chapter :data-idx="COUNT_BASE" :data-cover="countActive.coverArt ?? ''"
            class="ch seen sticky top-0 flex h-dvh items-center overflow-hidden px-6 sm:px-12">
            <CoverBackdrop :id="countActive.coverArt" :tint="0.42" />

            <div class="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
              <span :key="'ghost-' + countIdx" class="ghost-rank tabular">{{ countRank }}</span>
            </div>

            <div class="relative grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
              <div class="flex flex-col items-start gap-7 sm:flex-row sm:items-center sm:gap-10">
                <VinylHero :key="'art-' + countIdx" :id="countActive.coverArt" :name="cleanArtist(countActive.name)"
                  class="swap-art w-[46vw] max-w-[230px] flex-none sm:w-[26vh]" />
                <div :key="'txt-' + countIdx" class="swap-txt min-w-0">
                  <div class="label" style="color:oklch(0.97 0.02 80 / 0.75)">
                    {{ countRank === 1 ? `Your artist of ${year}` : `No. ${countRank}` }}
                  </div>
                  <RouterLink :to="`/artists/${countActive.artistId}`"
                    class="mt-2 block text-3xl font-black leading-[0.95] text-white hover:underline sm:text-5xl"
                    style="text-shadow:0 2px 28px oklch(0.1 0.02 40 / 0.55)">{{ cleanArtist(countActive.name) }}</RouterLink>
                  <div class="tabular mt-3 text-sm font-semibold" style="color:oklch(0.97 0.02 80 / 0.8)">
                    {{ formatNumber(countActive.plays) }} {{ countActive.plays === 1 ? 'play' : 'plays' }} · {{ formatDuration(countActive.seconds) }}
                  </div>
                  <div class="mt-5 flex flex-wrap gap-x-7 gap-y-3">
                    <div>
                      <div class="tabular text-xl font-black" :style="{ color: 'var(--accent)' }">{{ shareOfYear(countActive.plays) }}</div>
                      <div class="label mt-0.5 text-[10px]">of your year</div>
                    </div>
                    <div v-if="runOfListening(details[countActive.artistId])">
                      <div class="tabular text-xl font-black text-white">{{ runOfListening(details[countActive.artistId]) }}</div>
                      <div class="label mt-0.5 text-[10px]">first to last play</div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="details[countActive.artistId]?.related?.length" :key="'trk-' + countIdx" class="swap-list min-w-0">
                <div class="label mb-3" style="color:oklch(0.97 0.02 80 / 0.7)">Most played by {{ cleanArtist(countActive.name) }}</div>
                <div class="flex flex-col">
                  <button v-for="(r, ri) in details[countActive.artistId].related.slice(0, 5)" :key="r.id"
                    class="trk flex w-full items-center gap-3 rounded-lg border-b border-[oklch(0.97_0.02_80/0.12)] px-2 py-2.5 text-left transition-colors last:border-0 hover:bg-[oklch(0.97_0.02_80/0.1)]"
                    @click="playArtistTrack(countActive!.artistId, ri)">
                    <span class="tabular w-4 flex-none text-right text-[11px] font-bold" style="color:oklch(0.97 0.02 80 / 0.5)">{{ ri + 1 }}</span>
                    <CoverArt :id="r.hasCoverArt ? r.id : null" :name="r.title" :size="80" class="h-9 w-9 flex-none rounded" />
                    <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">{{ r.title }}</span>
                    <span class="tabular flex-none text-[12.5px] font-semibold" style="color:oklch(0.97 0.02 80 / 0.75)">{{ formatNumber(r.plays) }}</span>
                  </button>
                </div>
                <div v-if="details[countActive.artistId].history?.length" class="mt-5">
                  <div class="label mb-2 text-[10px]" style="color:oklch(0.97 0.02 80 / 0.55)">Across the year</div>
                  <LineArea :values="details[countActive.artistId].history.map((h) => h.plays)" :height="70" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section data-chapter data-finale :data-idx="finaleIdx" :data-cover="heroCover ?? ''"
          class="ch relative flex h-dvh snap-start flex-col justify-center overflow-hidden px-6 sm:px-12">
          <CoverBackdrop :id="heroCover" :tint="0.55" />
          <div class="drift relative flex flex-wrap items-center gap-x-16 gap-y-10">
            <div class="min-w-0 flex-1">
              <div class="label" style="letter-spacing:0.14em">All of it, in the end</div>
              <div class="mt-4 text-[clamp(4rem,13vw,9rem)] font-black leading-[0.85] tracking-tight" :style="{ color: 'var(--accent)' }">
                <Odometer :value="totals?.plays ?? 0" :format="formatNumber" :duration="1500" />
              </div>
              <div class="mt-4 text-lg font-semibold text-muted sm:text-xl">plays · {{ formatDuration(totals?.seconds ?? 0) }} of listening</div>
              <div class="mt-10 flex flex-wrap gap-3">
                <button
                  class="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[color:var(--color-bg)] transition-transform duration-150 hover:scale-[1.03] active:scale-95"
                  :style="{ background: 'var(--accent)' }" @click="playYear">
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  Play your year
                </button>
                <button
                  class="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-bold text-muted transition-colors hover:text-text disabled:opacity-60"
                  :disabled="rendering" @click="download">
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M5 21h14" /></svg>
                  {{ rendering ? 'Rendering…' : 'Download card' }}
                </button>
                <button class="rounded-full px-5 py-2.5 text-sm font-bold text-faint transition-colors hover:text-text" @click="router.push('/')">Back to Spindle</button>
              </div>
            </div>
            <div class="w-full max-w-[320px] flex-none sm:max-w-[380px] lg:max-w-[min(30vw,460px)] xl:max-w-[520px]">
              <img v-if="cardUrl" :src="cardUrl" alt="Wrapped share card preview" class="w-full rounded-2xl shadow-[0_40px_110px_-28px_oklch(0.08_0.02_40/0.95)]" />
              <div v-else class="grid aspect-[4/5] w-full place-items-center rounded-2xl border border-line/60 bg-[oklch(0.13_0.02_50/0.5)] text-xs text-faint backdrop-blur">Rendering your card…</div>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ch { opacity: 0; transition: opacity 0.6s var(--ease-out-quint); }
.ch.seen { opacity: 1; }

.mosaic { overflow: hidden; }
.mosaic-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  width: 150%;
  height: 150%;
  margin: -12% 0 0 -25%;
  animation: drift 48s linear infinite alternate;
}
@keyframes drift {
  from { transform: translate3d(0, 0, 0) scale(1.02); }
  to   { transform: translate3d(4%, -5%, 0) scale(1.12); }
}
.scroll-cue { animation: cue 2.4s var(--ease-out-quint) infinite; }
@keyframes cue {
  0%, 100% { opacity: 0.45; transform: translateY(0); }
  50%      { opacity: 1; transform: translateY(4px); }
}

.seen .tile { animation: deal 0.5s var(--ease-out-quint) backwards; }
@keyframes deal {
  from { opacity: 0; transform: translateY(10px) scale(0.9); }
  to   { opacity: 1; transform: none; }
}

.seen .record-row { animation: slide 0.55s var(--ease-out-quint) backwards; }
.seen .record-row:nth-child(2) { animation-delay: 0.09s; }
.seen .record-row:nth-child(3) { animation-delay: 0.18s; }
@keyframes slide {
  from { opacity: 0; transform: translateX(-22px); }
  to   { opacity: 1; transform: none; }
}

.drift { transform: translate3d(0, calc(var(--p, 0) * -22px), 0); will-change: transform; }

.intro-wash {
  background:
    radial-gradient(60% 55% at 18% 22%, var(--accent-2) 0%, transparent 65%),
    radial-gradient(55% 50% at 82% 78%, var(--accent-3) 0%, transparent 65%);
  opacity: 0.42;
  animation: wash 34s ease-in-out infinite alternate;
}
@keyframes wash {
  from { transform: scale(1) translate3d(0, 0, 0); opacity: 0.32; }
  to   { transform: scale(1.25) translate3d(-4%, 3%, 0); opacity: 0.5; }
}

.year-line :deep(svg) { width: 100%; }
.seen .year-line { animation: fade 0.5s ease both; }

.clock-big :deep(svg) { width: 100%; height: auto; }

.ghost-rank {
  font-size: min(92vh, 58vw);
  font-weight: 900;
  line-height: 0.75;
  color: transparent;
  -webkit-text-stroke: 2px oklch(0.97 0.02 80 / 0.16);
  animation: ghost-in 0.7s var(--ease-out-quint) both;
}
@keyframes ghost-in {
  from { opacity: 0; transform: scale(1.12); }
  to   { opacity: 1; transform: none; }
}

.swap-art { animation: swap-art 0.6s var(--ease-out-quint) both; }
@keyframes swap-art {
  from { opacity: 0; transform: translateY(22px) scale(0.92) rotate(-8deg); }
  to   { opacity: 1; transform: none; }
}
.swap-txt { animation: slide 0.55s var(--ease-out-quint) both; }
.swap-list { animation: slide 0.55s var(--ease-out-quint) 0.08s both; }

.art { transform: scale(1.08); transition: transform 1.1s var(--ease-out-quint); }
.seen .art { transform: scale(1); }
.seen .trk { animation: slide 0.5s var(--ease-out-quint) backwards; }
.seen .trk:nth-child(1) { animation-delay: 0.22s; }
.seen .trk:nth-child(2) { animation-delay: 0.29s; }
.seen .trk:nth-child(3) { animation-delay: 0.36s; }
.seen .trk:nth-child(4) { animation-delay: 0.43s; }
.seen .trk:nth-child(5) { animation-delay: 0.50s; }

@media (prefers-reduced-motion: reduce) {
  .ch { transition: none; }
  .mosaic-grid, .scroll-cue, .intro-wash { animation: none; }
  .seen .tile, .seen .record-row, .seen .trk { animation: none; }
  .art, .seen .art { transition: none; transform: none; }
  .drift { transform: none; }
  .ghost-rank, .swap-art, .swap-txt, .swap-list, .seen .year-line { animation: none; }
}
</style>
