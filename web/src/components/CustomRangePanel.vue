<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { api } from "@/api/client";
import type { TimePoint } from "@/api/types";
import { PRESETS, presetWindow, clampWindow, type PresetId, type DateWindow } from "@/lib/ranges";
import { formatNumber, formatDuration, formatRangeLabel } from "@/lib/format";

const props = defineProps<{ initial: DateWindow | null }>();
const emit = defineEmits<{ (e: "apply", w: DateWindow): void; (e: "cancel"): void }>();

const DAYMS = 86400000;
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mid = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addM = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const today = mid(new Date());
const todayTs = today.getTime();

let dailyPromise: Promise<TimePoint[]> | null = null;
function loadDaily() { return (dailyPromise ??= api.timeseries({ range: "all", bucket: "day" })); }

const daily = ref(new Map<string, { plays: number; seconds: number }>());
const dataStart = ref(mid(new Date(todayTs - 365 * DAYMS)));
const hmax = ref(1);

onMounted(async () => {
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  const series = await loadDaily();
  const m = new Map<string, { plays: number; seconds: number }>();
  let minMs = Infinity;
  for (const p of series) {
    const d = new Date(p.bucket * DAYMS);
    m.set(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, { plays: p.plays, seconds: p.seconds });
    if (p.bucket * DAYMS < minMs) minMs = p.bucket * DAYMS;
  }
  daily.value = m;
  if (isFinite(minMs)) { const d = new Date(minMs); dataStart.value = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  const vals = [...m.values()].map((v) => v.plays).filter((v) => v > 0).sort((a, b) => a - b);
  hmax.value = vals.length ? vals[Math.floor(vals.length * 0.95)] : 1;
});
onBeforeUnmount(() => {
  document.removeEventListener("pointermove", onMove);
  document.removeEventListener("pointerup", onUp);
  cancelAnimationFrame(raf);
});

const heatOf = (p: number) => (p <= 0 ? 0 : 0.14 + 0.6 * Math.min(1, Math.sqrt(p) / Math.sqrt(hmax.value)));
const clamp = (d: Date) => (d < dataStart.value ? dataStart.value : d > today ? today : d);

const initFrom = props.initial ? mid(new Date(props.initial.from * 1000)) : mid(new Date(todayTs - 29 * DAYMS));
const initTo = props.initial ? mid(new Date(props.initial.to * 1000)) : today;
const view = ref(addM(initTo, -1));
const from = ref(initFrom);
const to = ref(initTo);
const activePreset = ref<PresetId | null>(null);

const picking = ref(false);
const pendingStart = ref<Date | null>(null);
const previewEnd = ref<Date | null>(null);
let selecting = false, moved = false, lastTs: number | null = null;

const shown = computed(() => {
  if (picking.value && pendingStart.value) {
    const a = pendingStart.value, b = previewEnd.value ?? pendingStart.value;
    return a <= b ? { a, b } : { a: b, b: a };
  }
  return { a: from.value, b: to.value };
});

interface Cell { ts: number; day: number; heat: number; bad: boolean; }
function monthCells(anchorD: Date): (Cell | null)[] {
  const y = anchorD.getFullYear(), m = anchorD.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  const out: (Cell | null)[] = [];
  for (let i = 0; i < lead; i++) out.push(null);
  for (let dn = 1; dn <= dim; dn++) {
    const d = new Date(y, m, dn), bad = d > today || d < dataStart.value;
    out.push({ ts: d.getTime(), day: dn, heat: bad ? 0 : heatOf(daily.value.get(keyOf(d))?.plays ?? 0), bad });
  }
  return out;
}
const grid0 = computed(() => monthCells(view.value));
const grid1 = computed(() => monthCells(addM(view.value, 1)));
const grids = computed(() => [grid0.value, grid1.value]);
const title0 = computed(() => view.value.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
const title1 = computed(() => addM(view.value, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }));

const monthTs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getTime();
const firstMonthTs = computed(() => monthTs(dataStart.value));
const lastMonthTs = computed(() => monthTs(today));
const monthAgg = computed(() => {
  const agg = new Map<string, number>();
  for (const [k, v] of daily.value) { const ym = k.slice(0, 7); agg.set(ym, (agg.get(ym) ?? 0) + v.plays); }
  return agg;
});
const monthPlays = (y: number, m: number) => monthAgg.value.get(`${y}-${pad(m + 1)}`) ?? 0;
const mHmax = computed(() => { const v = [...monthAgg.value.values()].filter((n) => n > 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length * 0.9)] : 1; });
const mHeatOf = (p: number) => (p <= 0 ? 0.05 : 0.18 + 0.62 * Math.min(1, Math.sqrt(p) / Math.sqrt(mHmax.value)));

interface Yr { y: number; plays: number; }
const yearly = computed<Yr[]>(() => {
  const agg = new Map<number, number>();
  for (const [k, v] of monthAgg.value) agg.set(+k.slice(0, 4), (agg.get(+k.slice(0, 4)) ?? 0) + v);
  const out: Yr[] = [];
  for (let y = dataStart.value.getFullYear(); y <= today.getFullYear(); y++) out.push({ y, plays: agg.get(y) ?? 0 });
  return out;
});
const yHmax = computed(() => { const v = yearly.value.map((x) => x.plays).filter((n) => n > 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length * 0.9)] : 1; });
const yHeatOf = (p: number) => (p <= 0 ? 0.05 : 0.2 + 0.6 * Math.min(1, Math.sqrt(p) / Math.sqrt(yHmax.value)));
const multiYear = computed(() => yearly.value.length > 1);

const focusYear = computed(() => view.value.getFullYear());
interface Mo { ts: number; y: number; m: number; plays: number; bad: boolean; }
const focusMonths = computed<Mo[]>(() => {
  const y = focusYear.value, out: Mo[] = [];
  for (let m = 0; m < 12; m++) { const ts = new Date(y, m, 1).getTime(); out.push({ ts, y, m, plays: monthPlays(y, m), bad: ts < firstMonthTs.value || ts > lastMonthTs.value }); }
  return out;
});

const monthLabel = (o: { y: number; m: number }) => new Date(o.y, o.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const legendStops = [0.12, 0.3, 0.5, 0.72, 0.95];

function peakMonthOf(y: number) { let bm = 0, bp = -1; for (let m = 0; m < 12; m++) { const p = monthPlays(y, m); if (p > bp) { bp = p; bm = m; } } return bm; }
function clampView(md: Date) { return md.getTime() >= lastMonthTs.value ? addM(new Date(today.getFullYear(), today.getMonth(), 1), -1) : md; }
function clickYear(yr: Yr) { view.value = clampView(new Date(yr.y, yr.plays ? peakMonthOf(yr.y) : 0, 1)); }
function jumpToMonth(mo: Mo) { if (!mo.bad) view.value = clampView(new Date(mo.y, mo.m, 1)); }

const crpEl = ref<HTMLElement | null>(null);
const tip = ref({ show: false, x: 0, y: 0, main: "", sub: "", hot: false });
const playsText = (p: number) => (p ? `${formatNumber(p)} ${p === 1 ? "play" : "plays"}` : "No plays");
function tipAt(target: HTMLElement, main: string, p: number) {
  const host = crpEl.value; if (!host) return;
  const hr = host.getBoundingClientRect(), r = target.getBoundingClientRect();
  tip.value = { show: true, x: r.left - hr.left + r.width / 2, y: r.top - hr.top, main, sub: playsText(p), hot: p > 0 };
}
function dayTip(c: Cell, e: MouseEvent) {
  if (c.bad) return;
  tipAt(e.currentTarget as HTMLElement, new Date(c.ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), daily.value.get(keyOf(new Date(c.ts)))?.plays ?? 0);
}
function monthTip(mo: Mo, e: MouseEvent) { if (mo.bad) { hideTip(); return; } tipAt(e.currentTarget as HTMLElement, monthLabel(mo), mo.plays); }
function yearTip(yr: Yr, e: MouseEvent) { tipAt(e.currentTarget as HTMLElement, String(yr.y), yr.plays); }
function hideTip() { tip.value.show = false; }

function cellClass(c: Cell) {
  const { a, b } = shown.value, aT = a.getTime(), bT = b.getTime(), end = c.ts === aT || c.ts === bT;
  return { void: c.bad, end, inrange: c.ts >= aT && c.ts <= bT && !end, today: c.ts === todayTs, preview: picking.value && (end || (c.ts > aT && c.ts < bT)) };
}

function commit(a: Date, b: Date) {
  const x = clamp(a), y = clamp(b);
  from.value = x <= y ? x : y; to.value = x <= y ? y : x;
  picking.value = false; pendingStart.value = null; previewEnd.value = null;
}
function onDownCell(c: Cell, e: PointerEvent) {
  if (c.bad) return;
  e.preventDefault();
  activePreset.value = null;
  const d = new Date(c.ts);
  if (picking.value && pendingStart.value) { commit(pendingStart.value, d); return; }
  pendingStart.value = d; previewEnd.value = null; picking.value = true;
  selecting = true; moved = false; lastTs = c.ts;
}
function tsAt(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const c = el?.closest("[data-ts]") as HTMLElement | null;
  return c?.dataset.ts ? +c.dataset.ts : null;
}
function onMove(e: PointerEvent) {
  if (!picking.value) return;
  const ts = tsAt(e.clientX, e.clientY);
  if (ts == null) return;
  if (selecting && ts !== lastTs) { moved = true; lastTs = ts; }
  if (!previewEnd.value || ts !== previewEnd.value.getTime()) previewEnd.value = new Date(ts);
}
function onUp() {
  if (!selecting) return;
  selecting = false;
  if (moved && pendingStart.value && previewEnd.value) commit(pendingStart.value, previewEnd.value);
}

function applyPreset(id: PresetId) {
  const w = clampWindow(presetWindow(id), Math.floor(dataStart.value.getTime() / 1000), Math.floor(todayTs / 1000));
  picking.value = false; pendingStart.value = null; previewEnd.value = null; selecting = false;
  from.value = mid(new Date(w.from * 1000)); to.value = mid(new Date(w.to * 1000)); view.value = addM(to.value, -1);
  activePreset.value = id;
}
const presetLen = (id: PresetId) => { const w = presetWindow(id); return Math.max(1, Math.round((w.to - w.from) / 86400) + 1) + "d"; };

const stats = computed(() => {
  let plays = 0, seconds = 0;
  const { a, b } = shown.value;
  for (let t = a.getTime(); t <= b.getTime(); t += DAYMS) { const e = daily.value.get(keyOf(new Date(t))); if (e) { plays += e.plays; seconds += e.seconds; } }
  return { plays, seconds };
});
const shownPlays = ref(0);
let raf = 0;
watch(() => stats.value.plays, (target) => {
  cancelAnimationFrame(raf);
  const start = shownPlays.value, t0 = performance.now();
  const step = (t: number) => { const k = Math.min(1, (t - t0) / 420); shownPlays.value = Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
}, { immediate: true });

const startChip = computed(() => (picking.value && pendingStart.value ? shortDate(pendingStart.value) : shortDate(from.value)));
const endChip = computed(() => (picking.value ? (previewEnd.value && previewEnd.value.getTime() !== pendingStart.value?.getTime() ? shortDate(shown.value.b) : "Pick end") : shortDate(to.value)));
const hint = computed(() => (picking.value ? "Now pick the end day" : "Click a start day, then an end. Or drag across."));
const rangeLabel = computed(() => formatRangeLabel(Math.floor(from.value.getTime() / 1000), Math.floor(to.value.getTime() / 1000)));
function apply() { emit("apply", { from: Math.floor(from.value.getTime() / 1000), to: Math.floor(to.value.getTime() / 1000) + 86399 }); }

const DAY_HEAT_ON = "absolute inset-0 rounded-[9px] bg-heat opacity-[var(--heat-o)] transition-opacity duration-150 ease-out-quint group-hover/day:opacity-[0.36]";
const DAY_HEAT_OFF = "absolute inset-0 rounded-[9px] bg-heat opacity-0";
const DAY_FILL = "absolute inset-0 z-[1] bg-[var(--accent)] transition-opacity duration-200 ease-out-quint";
const MO_ROOT = "group/mo relative min-w-0 flex-1 cursor-pointer rounded-[4px] border-0 bg-transparent p-0 outline-none transition-transform duration-150 ease-out-quint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const MO_HEAT_ON = "absolute inset-0 rounded-[4px] bg-heat opacity-[var(--h)] transition-opacity duration-150 ease-out-quint group-hover/mo:opacity-[calc(var(--h)_+_0.16)]";
const MO_HEAT_SEL = "absolute inset-0 rounded-[4px] bg-[var(--accent)] opacity-[max(var(--h),0.34)]";

function dayUi(c: Cell) {
  const s = cellClass(c);
  const root =
    "group/day relative grid aspect-square cursor-pointer place-items-center border-0 bg-transparent text-[12.5px] font-semibold tabular-nums outline-none transition-[transform,color] duration-150 ease-out-quint animate-deal-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] " +
    (s.void
      ? "cursor-default text-[oklch(0.5_0.012_60)]"
      : s.end
        ? "font-extrabold text-ink hover:-translate-y-px"
        : s.inrange
          ? "font-bold text-text hover:-translate-y-px"
          : "text-muted hover:-translate-y-px hover:text-text");
  const fill = s.end
    ? DAY_FILL + " rounded-[9px] opacity-100 shadow-[0_4px_16px_-5px_var(--accent)]"
    : s.inrange
      ? DAY_FILL + " rounded-none [inset:0_-1.6px] " + (s.preview ? "opacity-30" : "opacity-[0.34]") +
        " shadow-[inset_0_1px_0_color-mix(in_oklch,var(--accent)_60%,transparent),inset_0_-1px_0_color-mix(in_oklch,var(--accent)_60%,transparent)]"
      : DAY_FILL + " rounded-[9px] opacity-0";
  const num =
    "relative z-[2]" +
    (s.today
      ? " after:absolute after:-bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:content-[''] " + (s.end ? "after:bg-ink" : "after:bg-[var(--accent)]")
      : "");
  return { c, root, heat: s.end || s.inrange ? DAY_HEAT_OFF : DAY_HEAT_ON, heatStyle: { "--heat-o": String(c.heat) }, fill, num };
}
const dayGrids = computed(() => grids.value.map((g) => g.map((c) => (c ? dayUi(c) : null))));

const stripYears = computed(() =>
  yearly.value.map((yr) => {
    const focus = yr.y === focusYear.value;
    const insel = yr.y >= from.value.getFullYear() && yr.y <= to.value.getFullYear();
    return {
      yr,
      root: MO_ROOT + (yr.plays === 0 ? " cursor-default opacity-40" : " hover:-translate-y-[1.5px]"),
      heat: insel ? MO_HEAT_SEL : MO_HEAT_ON,
      heatStyle: { "--h": String(yHeatOf(yr.plays)) },
      ylab: "pointer-events-none absolute inset-x-0 top-[calc(100%+3px)] text-center text-[10px] font-bold tracking-[0.02em] " + (focus ? "text-[var(--accent)]" : "text-faint"),
    };
  }),
);
const stripMonths = computed(() =>
  focusMonths.value.map((mo) => {
    const moEnd = new Date(mo.y, mo.m + 1, 0).getTime();
    const insel = !mo.bad && moEnd >= from.value.getTime() && mo.ts <= to.value.getTime();
    return {
      mo,
      root: MO_ROOT + (mo.bad ? " cursor-default opacity-40" : " enabled:hover:-translate-y-[1.5px]"),
      heat: insel ? MO_HEAT_SEL : MO_HEAT_ON,
      heatStyle: { "--h": String(mHeatOf(mo.plays)) },
    };
  }),
);
</script>

<template>
  <div
    ref="crpEl"
    class="relative grid w-[min(680px,calc(100vw-2rem))] select-none grid-cols-[186px_1fr] gap-5 rounded-[20px] border border-line bg-surface p-5 shadow-[0_34px_80px_-34px_oklch(0.09_0.02_50_/_0.85),inset_0_1px_0_0_oklch(1_0_0_/_0.03)] max-[620px]:grid-cols-1"
  >
    <div class="flex flex-col gap-[3px] border-r border-line pr-[18px] max-[620px]:flex-row max-[620px]:flex-wrap max-[620px]:border-b max-[620px]:border-r-0 max-[620px]:pb-3 max-[620px]:pr-0">
      <div class="label px-[10px] pb-2 pt-[2px] max-[620px]:w-full max-[620px]:pb-1">Quick ranges</div>
      <button
        v-for="p in PRESETS"
        :key="p.id"
        class="flex cursor-pointer items-center justify-between gap-2 rounded-[11px] px-[11px] py-[9px] text-left text-[13.5px] font-semibold transition-[background,color,transform] duration-150 ease-out-quint hover:translate-x-0.5 hover:bg-surface-2 hover:text-text"
        :class="activePreset === p.id ? 'bg-[var(--accent-soft)] text-text' : 'text-muted'"
        @click="applyPreset(p.id)"
      >
        <span>{{ p.label }}</span>
        <span class="text-[11px] tabular-nums" :class="activePreset === p.id ? 'text-[var(--accent)]' : 'text-faint'">{{ presetLen(p.id) }}</span>
      </button>
    </div>

    <div class="flex min-w-0 flex-col gap-[13px]">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-baseline gap-1.5 rounded-full border border-line bg-bg px-[11px] py-[5px]">
            <span class="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">Start</span>
            <span class="text-[13px] font-bold tabular-nums tracking-[-0.01em] text-text">{{ startChip }}</span>
          </span>
          <svg class="size-4 shrink-0" :class="picking ? 'text-[var(--accent)]' : 'text-faint'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          <span
            class="inline-flex items-baseline gap-1.5 rounded-full border px-[11px] py-[5px]"
            :class="picking ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--accent)_14%,transparent)]' : 'border-line bg-bg'"
          >
            <span class="text-[10px] font-bold uppercase tracking-[0.06em]" :class="picking ? 'text-[var(--accent)]' : 'text-faint'">End</span>
            <span class="text-[13px] font-bold tabular-nums tracking-[-0.01em] text-text">{{ endChip }}</span>
          </span>
        </div>
        <span class="text-[12px] font-semibold" :class="picking ? 'text-[var(--accent)]' : 'text-faint'">{{ hint }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[10.5px] font-bold uppercase tracking-[0.05em] text-faint">Your history<template v-if="multiYear"> · {{ focusYear }}</template></span>
          <span class="inline-flex items-center gap-[3px]">
            <span class="text-[10px] font-bold text-faint">Less</span>
            <i v-for="(s, i) in legendStops" :key="i" class="size-[11px] rounded-[2px] bg-heat" :style="{ opacity: s }"></i>
            <span class="text-[10px] font-bold text-faint">More</span>
          </span>
        </div>
        <div v-if="multiYear" class="relative mb-4 flex h-7 items-stretch gap-[2px]">
          <button v-for="y in stripYears" :key="y.yr.y" :class="y.root" :aria-label="String(y.yr.y)" @click="clickYear(y.yr)" @mouseenter="yearTip(y.yr, $event)" @mouseleave="hideTip">
            <span :class="y.heat" :style="y.heatStyle"></span>
            <span :class="y.ylab">{{ String(y.yr.y).slice(2) }}</span>
          </button>
        </div>
        <div class="relative flex h-7 items-stretch gap-[2px]">
          <button v-for="mt in stripMonths" :key="mt.mo.ts" :class="mt.root" :disabled="mt.mo.bad" :aria-label="monthLabel(mt.mo)" @click="jumpToMonth(mt.mo)" @mouseenter="monthTip(mt.mo, $event)" @mouseleave="hideTip">
            <span :class="mt.heat" :style="mt.heatStyle"></span>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <button class="grid size-[30px] cursor-pointer place-items-center rounded-[9px] border border-line bg-transparent text-muted transition-[background,color,transform] duration-150 ease-out-quint hover:bg-surface-2 hover:text-text active:scale-90" aria-label="Previous month" @click="view = addM(view, -1)">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div class="flex flex-1 justify-between gap-[26px] px-1">
          <span class="text-[15px] font-extrabold tracking-[-0.01em]">{{ title0 }}</span>
          <span class="text-[15px] font-extrabold tracking-[-0.01em]">{{ title1 }}</span>
        </div>
        <button class="grid size-[30px] cursor-pointer place-items-center rounded-[9px] border border-line bg-transparent text-muted transition-[background,color,transform] duration-150 ease-out-quint hover:bg-surface-2 hover:text-text active:scale-90" aria-label="Next month" @click="view = addM(view, 1)">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      <div class="grid grid-cols-2 gap-[26px] max-[620px]:grid-cols-1">
        <div v-for="(g, gi) in dayGrids" :key="gi" class="grid touch-none grid-cols-7 gap-[3px]">
          <div v-for="d in DOW" :key="d" class="pb-1 text-center text-[10.5px] font-bold uppercase tracking-[0.04em] text-faint">{{ d }}</div>
          <template v-for="(cell, i) in g" :key="cell ? cell.c.ts : 'e' + gi + i">
            <div v-if="!cell" class="invisible aspect-square"></div>
            <button
              v-else
              :class="cell.root"
              :data-ts="cell.c.ts"
              :disabled="cell.c.bad"
              :style="{ animationDelay: i * 9 + 'ms' }"
              @pointerdown="onDownCell(cell.c, $event)"
              @mouseenter="dayTip(cell.c, $event)"
              @mouseleave="hideTip"
            >
              <span :class="cell.heat" :style="cell.heatStyle"></span>
              <span :class="cell.fill"></span>
              <span :class="cell.num">{{ cell.c.day }}</span>
            </button>
          </template>
        </div>
      </div>

      <div class="flex items-center justify-between gap-[14px] border-t border-line pt-[15px]">
        <div>
          <div class="text-[22px] font-extrabold tabular-nums tracking-[-0.02em]"><b class="text-[var(--accent)]">{{ formatNumber(shownPlays) }}</b> {{ stats.plays === 1 ? "play" : "plays" }}</div>
          <div class="mt-px text-[12px] text-faint">{{ formatDuration(stats.seconds) }} · {{ rangeLabel }}</div>
        </div>
        <div class="flex gap-2">
          <button class="cursor-pointer rounded-[11px] bg-transparent px-4 py-[9px] text-[13px] font-bold text-muted transition-[background,color] duration-150 ease-out-quint hover:bg-surface-2 hover:text-text" @click="emit('cancel')">Cancel</button>
          <button class="cursor-pointer rounded-[11px] bg-[var(--accent)] px-4 py-[9px] text-[13px] font-bold text-ink shadow-[0_2px_16px_-5px_var(--accent)] transition-transform duration-150 ease-out-quint hover:-translate-y-px hover:scale-[1.02] active:scale-95" @click="apply">Apply</button>
        </div>
      </div>
    </div>

    <Transition enter-active-class="transition-opacity duration-100 ease-out-quint" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-100" leave-to-class="opacity-0">
      <div
        v-if="tip.show"
        class="pointer-events-none absolute z-[5] flex flex-col gap-px whitespace-nowrap rounded-[9px] border border-line bg-bg px-[9px] py-[5px] shadow-[0_12px_26px_-14px_oklch(0.09_0.02_50_/_0.9)] after:absolute after:-bottom-[5px] after:left-1/2 after:size-[9px] after:-translate-x-1/2 after:rotate-45 after:border-b after:border-r after:border-line after:bg-bg after:content-['']"
        :style="{ left: tip.x + 'px', top: tip.y + 'px', transform: 'translate(-50%, calc(-100% - 9px))' }"
      >
        <b class="text-[12px] font-extrabold tracking-[-0.01em] text-text">{{ tip.main }}</b>
        <span class="text-[11px] font-bold tabular-nums" :class="tip.hot ? 'text-[var(--accent)]' : 'text-faint'">{{ tip.sub }}</span>
      </div>
    </Transition>
  </div>
</template>
