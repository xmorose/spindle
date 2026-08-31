<script setup lang="ts">
import { computed, ref } from "vue";
import { PRESETS, presetWindow, clampWindow, type PresetId, type DateWindow } from "@/lib/ranges";
import { formatNumber, formatDuration, formatRangeLabel } from "@/lib/format";
import {
  DAY_MS,
  WEEKDAY_LABELS,
  addMonths,
  clampDate,
  dayFromUnixSeconds,
  daysInMonth,
  endOfMonth,
  formatFullDay,
  formatMonthYear,
  formatShortDate,
  leadingBlanks,
  startOfDay,
  startOfMonth,
  toUnixSeconds,
} from "@/lib/calendar";
import { totalsBetween } from "@/lib/heatmap";
import { useDailyHistory, type YearTotal } from "@/composables/useDailyHistory";
import { useRangeSelection } from "@/composables/useRangeSelection";
import { useAnchoredTip } from "@/composables/useAnchoredTip";
import { useCountUp } from "@/composables/useCountUp";

const props = defineProps<{ initial: DateWindow | null }>();
const emit = defineEmits<{ (e: "apply", w: DateWindow): void; (e: "cancel"): void }>();

const today = startOfDay(new Date());
const history = useDailyHistory(today);

const selection = useRangeSelection({
  initialFrom: props.initial ? dayFromUnixSeconds(props.initial.from) : startOfDay(new Date(today.getTime() - 29 * DAY_MS)),
  initialTo: props.initial ? dayFromUnixSeconds(props.initial.to) : today,
  clamp: (d) => clampDate(d, history.dataStart.value, today),
});
const { from, to, picking, pendingStart, previewEnd, shown } = selection;

const activePreset = ref<PresetId | null>(null);
const view = ref(addMonths(to.value, -1));

const viewMin = computed(() => startOfMonth(history.dataStart.value));
const viewMax = computed(() => addMonths(startOfMonth(today), -1));
const atViewMin = computed(() => view.value.getTime() <= viewMin.value.getTime());
const atViewMax = computed(() => view.value.getTime() >= viewMax.value.getTime());

function moveView(target: Date) {
  view.value = clampDate(target, viewMin.value, viewMax.value);
}
function stepView(months: number) {
  moveView(addMonths(view.value, months));
}

interface DayCell {
  timestamp: number;
  date: Date;
  dayOfMonth: number;
  heat: number;
  outside: boolean;
  isEdge: boolean;
  inRange: boolean;
  isToday: boolean;
}

function monthCells(anchor: Date): (DayCell | null)[] {
  const startTs = shown.value.start.getTime();
  const endTs = shown.value.end.getTime();
  const cells: (DayCell | null)[] = [];
  for (let blank = 0; blank < leadingBlanks(anchor); blank++) cells.push(null);
  for (let day = 1; day <= daysInMonth(anchor); day++) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), day);
    const timestamp = date.getTime();
    const outside = date > today || date < history.dataStart.value;
    const isEdge = !outside && (timestamp === startTs || timestamp === endTs);
    cells.push({
      timestamp,
      date,
      dayOfMonth: day,
      outside,
      isEdge,
      inRange: !outside && !isEdge && timestamp > startTs && timestamp < endTs,
      isToday: timestamp === today.getTime(),
      heat: outside ? 0 : history.dayHeat.value(history.playsOn(date)),
    });
  }
  return cells;
}

const calendars = computed(() =>
  [view.value, addMonths(view.value, 1)].map((anchor) => ({
    key: anchor.getTime(),
    title: formatMonthYear(anchor),
    cells: monthCells(anchor),
  })),
);

const focusYear = computed(() => view.value.getFullYear());
const multiYear = computed(() => history.years.value.length > 1);

const yearStrip = computed(() =>
  history.years.value.map((entry) => ({
    ...entry,
    heat: history.yearHeat.value(entry.plays),
    empty: entry.plays === 0,
    focused: entry.year === focusYear.value,
    selected: entry.year >= from.value.getFullYear() && entry.year <= to.value.getFullYear(),
  })),
);

const monthStrip = computed(() => {
  const year = focusYear.value;
  const firstMonth = startOfMonth(history.dataStart.value).getTime();
  const lastMonth = startOfMonth(today).getTime();
  return Array.from({ length: 12 }, (_, month) => {
    const start = new Date(year, month, 1);
    const timestamp = start.getTime();
    const outside = timestamp < firstMonth || timestamp > lastMonth;
    const plays = history.playsInMonth(year, month);
    return {
      year,
      month,
      timestamp,
      plays,
      outside,
      label: formatMonthYear(start),
      heat: history.monthHeat.value(plays),
      selected: !outside && endOfMonth(start).getTime() >= from.value.getTime() && timestamp <= to.value.getTime(),
    };
  });
});

function pickYear(entry: YearTotal) {
  activePreset.value = null;
  selection.selectSpan(new Date(entry.year, 0, 1), new Date(entry.year, 11, 31));
  moveView(startOfMonth(from.value));
}

function pickMonth(entry: { year: number; month: number; outside: boolean }) {
  if (entry.outside) return;
  activePreset.value = null;
  const start = new Date(entry.year, entry.month, 1);
  selection.selectSpan(start, endOfMonth(start));
  moveView(start);
}

function extendToToday() {
  activePreset.value = null;
  selection.selectSpan(pendingStart.value ?? from.value, today);
  moveView(startOfMonth(today));
}
const atToday = computed(() => !picking.value && to.value.getTime() === today.getTime());

function applyPreset(id: PresetId) {
  const window = clampWindow(presetWindow(id), toUnixSeconds(history.dataStart.value), toUnixSeconds(today));
  selection.selectSpan(dayFromUnixSeconds(window.from), dayFromUnixSeconds(window.to));
  moveView(addMonths(to.value, -1));
  activePreset.value = id;
}
function presetLength(id: PresetId): string {
  const window = presetWindow(id);
  return `${Math.max(1, Math.round((window.to - window.from) / 86400) + 1)}d`;
}

function pressDay(cell: DayCell) {
  if (cell.outside) return;
  activePreset.value = null;
  selection.pressDay(cell.date);
}

const totals = computed(() => totalsBetween(history.daily.value, shown.value.start, shown.value.end));
const animatedPlays = useCountUp(() => totals.value.plays);

const panel = ref<HTMLElement | null>(null);
const { tip, showTip, hideTip } = useAnchoredTip(panel);
const playsText = (plays: number) => (plays ? `${formatNumber(plays)} ${plays === 1 ? "play" : "plays"}` : "No plays");

function showDayTip(cell: DayCell, event: MouseEvent) {
  if (cell.outside) return;
  const plays = history.playsOn(cell.date);
  showTip(event.currentTarget as HTMLElement, formatFullDay(cell.date), playsText(plays), plays > 0);
}
function showMonthTip(entry: { label: string; plays: number; outside: boolean }, event: MouseEvent) {
  if (entry.outside) {
    hideTip();
    return;
  }
  showTip(event.currentTarget as HTMLElement, entry.label, playsText(entry.plays), entry.plays > 0);
}
function showYearTip(entry: YearTotal, event: MouseEvent) {
  showTip(event.currentTarget as HTMLElement, String(entry.year), playsText(entry.plays), entry.plays > 0);
}

const startChip = computed(() => formatShortDate(picking.value && pendingStart.value ? pendingStart.value : from.value));
const endChip = computed(() => {
  if (!picking.value) return formatShortDate(to.value);
  const preview = previewEnd.value;
  if (preview && preview.getTime() !== pendingStart.value?.getTime()) return formatShortDate(shown.value.end);
  return "Pick end";
});
const hint = computed(() => (picking.value ? "Now pick the end day" : "Pick a year, a month, or drag across days"));
const rangeLabel = computed(() => formatRangeLabel(toUnixSeconds(from.value), toUnixSeconds(to.value)));

const legendStops = [0.12, 0.3, 0.5, 0.72, 0.95];

function apply() {
  emit("apply", { from: toUnixSeconds(from.value), to: toUnixSeconds(to.value) + 86399 });
}
</script>

<template>
  <div
    ref="panel"
    class="relative grid w-[min(680px,calc(100vw-2rem))] select-none grid-cols-[186px_1fr] gap-5 rounded-[20px] border border-line bg-surface p-5 shadow-[0_34px_80px_-34px_oklch(0.09_0.02_50_/_0.85),inset_0_1px_0_0_oklch(1_0_0_/_0.03)] max-[620px]:grid-cols-1"
  >
    <div class="flex flex-col gap-[3px] border-r border-line pr-[18px] max-[620px]:flex-row max-[620px]:flex-wrap max-[620px]:border-b max-[620px]:border-r-0 max-[620px]:pb-3 max-[620px]:pr-0">
      <div class="label px-[10px] pb-2 pt-[2px] max-[620px]:w-full max-[620px]:pb-1">Quick ranges</div>
      <button
        v-for="preset in PRESETS"
        :key="preset.id"
        class="flex cursor-pointer items-center justify-between gap-2 rounded-[11px] px-[11px] py-[9px] text-left text-[13.5px] font-semibold transition-[background,color,transform] duration-150 ease-out-quint hover:translate-x-0.5 hover:bg-surface-2 hover:text-text"
        :class="activePreset === preset.id ? 'bg-[var(--accent-soft)] text-text' : 'text-muted'"
        @click="applyPreset(preset.id)"
      >
        <span>{{ preset.label }}</span>
        <span class="text-[11px] tabular-nums" :class="activePreset === preset.id ? 'text-[var(--accent)]' : 'text-faint'">{{ presetLength(preset.id) }}</span>
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
          <button
            class="inline-flex items-center gap-1 rounded-full border border-line bg-bg px-[10px] py-[6px] text-[10px] font-bold uppercase tracking-[0.06em] transition-[background,color,transform] duration-150 ease-out-quint enabled:cursor-pointer enabled:text-muted enabled:hover:border-[var(--accent)] enabled:hover:bg-[var(--accent-soft)] enabled:hover:text-text enabled:active:scale-95 disabled:cursor-default disabled:text-[oklch(0.5_0.012_60)]"
            :disabled="atToday"
            @click="extendToToday"
          >
            <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 5l7 7-7 7M4 12h16" /></svg>
            To today
          </button>
        </div>
        <span class="text-[12px] font-semibold" :class="picking ? 'text-[var(--accent)]' : 'text-faint'">{{ hint }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[10.5px] font-bold uppercase tracking-[0.05em] text-faint">Your history<template v-if="multiYear"> &middot; {{ focusYear }}</template></span>
          <span class="inline-flex items-center gap-[3px]">
            <span class="text-[10px] font-bold text-faint">Less</span>
            <i v-for="(stop, i) in legendStops" :key="i" class="size-[11px] rounded-[2px] bg-heat" :style="{ opacity: stop }"></i>
            <span class="text-[10px] font-bold text-faint">More</span>
          </span>
        </div>

        <div v-if="multiYear" class="relative mb-4 flex h-7 items-stretch gap-[2px]">
          <button
            v-for="entry in yearStrip"
            :key="entry.year"
            class="group/mo relative min-w-0 flex-1 cursor-pointer rounded-[4px] border-0 bg-transparent p-0 outline-none transition-transform duration-150 ease-out-quint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            :class="entry.empty ? 'cursor-default opacity-40' : 'hover:-translate-y-[1.5px]'"
            :aria-label="String(entry.year)"
            @click="pickYear(entry)"
            @mouseenter="showYearTip(entry, $event)"
            @mouseleave="hideTip"
          >
            <span
              class="absolute inset-0 rounded-[4px]"
              :class="entry.selected
                ? 'bg-[var(--accent)] opacity-[max(var(--h),0.34)]'
                : 'bg-heat opacity-[var(--h)] transition-opacity duration-150 ease-out-quint group-hover/mo:opacity-[calc(var(--h)_+_0.16)]'"
              :style="{ '--h': String(entry.heat) }"
            ></span>
            <span
              class="pointer-events-none absolute inset-x-0 top-[calc(100%+3px)] text-center text-[10px] font-bold tracking-[0.02em]"
              :class="entry.focused ? 'text-[var(--accent)]' : 'text-faint'"
            >{{ String(entry.year).slice(2) }}</span>
          </button>
        </div>

        <div class="relative flex h-7 items-stretch gap-[2px]">
          <button
            v-for="entry in monthStrip"
            :key="entry.timestamp"
            class="group/mo relative min-w-0 flex-1 cursor-pointer rounded-[4px] border-0 bg-transparent p-0 outline-none transition-transform duration-150 ease-out-quint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            :class="entry.outside ? 'cursor-default opacity-40' : 'enabled:hover:-translate-y-[1.5px]'"
            :disabled="entry.outside"
            :aria-label="entry.label"
            @click="pickMonth(entry)"
            @mouseenter="showMonthTip(entry, $event)"
            @mouseleave="hideTip"
          >
            <span
              class="absolute inset-0 rounded-[4px]"
              :class="entry.selected
                ? 'bg-[var(--accent)] opacity-[max(var(--h),0.34)]'
                : 'bg-heat opacity-[var(--h)] transition-opacity duration-150 ease-out-quint group-hover/mo:opacity-[calc(var(--h)_+_0.16)]'"
              :style="{ '--h': String(entry.heat) }"
            ></span>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between gap-1">
        <button
          class="grid size-[30px] place-items-center rounded-[9px] border border-line bg-transparent transition-[background,color,transform] duration-150 ease-out-quint enabled:cursor-pointer enabled:text-muted enabled:hover:bg-surface-2 enabled:hover:text-text enabled:active:scale-90 disabled:cursor-default disabled:border-line/50 disabled:text-[oklch(0.42_0.01_60)]"
          :disabled="atViewMin"
          aria-label="Previous year"
          @click="stepView(-12)"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 18l-6-6 6-6M11 18l-6-6 6-6" /></svg>
        </button>
        <button
          class="grid size-[30px] place-items-center rounded-[9px] border border-line bg-transparent transition-[background,color,transform] duration-150 ease-out-quint enabled:cursor-pointer enabled:text-muted enabled:hover:bg-surface-2 enabled:hover:text-text enabled:active:scale-90 disabled:cursor-default disabled:border-line/50 disabled:text-[oklch(0.42_0.01_60)]"
          :disabled="atViewMin"
          aria-label="Previous month"
          @click="stepView(-1)"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div class="flex flex-1 justify-between gap-[26px] px-1">
          <span v-for="calendar in calendars" :key="calendar.key" class="text-[15px] font-extrabold tracking-[-0.01em]">{{ calendar.title }}</span>
        </div>
        <button
          class="grid size-[30px] place-items-center rounded-[9px] border border-line bg-transparent transition-[background,color,transform] duration-150 ease-out-quint enabled:cursor-pointer enabled:text-muted enabled:hover:bg-surface-2 enabled:hover:text-text enabled:active:scale-90 disabled:cursor-default disabled:border-line/50 disabled:text-[oklch(0.42_0.01_60)]"
          :disabled="atViewMax"
          aria-label="Next month"
          @click="stepView(1)"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
        <button
          class="grid size-[30px] place-items-center rounded-[9px] border border-line bg-transparent transition-[background,color,transform] duration-150 ease-out-quint enabled:cursor-pointer enabled:text-muted enabled:hover:bg-surface-2 enabled:hover:text-text enabled:active:scale-90 disabled:cursor-default disabled:border-line/50 disabled:text-[oklch(0.42_0.01_60)]"
          :disabled="atViewMax"
          aria-label="Next year"
          @click="stepView(12)"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18l6-6-6-6M13 18l6-6-6-6" /></svg>
        </button>
      </div>

      <div class="grid grid-cols-2 gap-[26px] max-[620px]:grid-cols-1">
        <div v-for="calendar in calendars" :key="calendar.key" class="grid touch-none grid-cols-7 gap-[3px]">
          <div v-for="weekday in WEEKDAY_LABELS" :key="weekday" class="pb-1 text-center text-[10.5px] font-bold uppercase tracking-[0.04em] text-faint">{{ weekday }}</div>
          <template v-for="(cell, i) in calendar.cells" :key="cell ? cell.timestamp : `blank-${calendar.key}-${i}`">
            <div v-if="!cell" class="invisible aspect-square"></div>
            <button
              v-else
              class="group/day relative grid aspect-square cursor-pointer place-items-center border-0 bg-transparent text-[12.5px] font-semibold tabular-nums outline-none transition-[transform,color] duration-150 ease-out-quint animate-deal-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              :class="{
                'cursor-default text-[oklch(0.5_0.012_60)]': cell.outside,
                'font-extrabold text-ink hover:-translate-y-px': cell.isEdge,
                'font-bold text-text hover:-translate-y-px': cell.inRange,
                'text-muted hover:-translate-y-px hover:text-text': !cell.outside && !cell.isEdge && !cell.inRange,
              }"
              :data-ts="cell.timestamp"
              :disabled="cell.outside"
              :style="{ animationDelay: `${i * 9}ms` }"
              @pointerdown.prevent="pressDay(cell)"
              @mouseenter="showDayTip(cell, $event)"
              @mouseleave="hideTip"
            >
              <span
                class="absolute inset-0 rounded-[9px] bg-heat"
                :class="cell.isEdge || cell.inRange
                  ? 'opacity-0'
                  : 'opacity-[var(--heat-o)] transition-opacity duration-150 ease-out-quint group-hover/day:opacity-[0.36]'"
                :style="{ '--heat-o': String(cell.heat) }"
              ></span>
              <span
                class="absolute inset-0 z-[1] bg-[var(--accent)] transition-opacity duration-200 ease-out-quint"
                :class="{
                  'rounded-[9px] opacity-100 shadow-[0_4px_16px_-5px_var(--accent)]': cell.isEdge,
                  'rounded-none [inset:0_-1.6px] shadow-[inset_0_1px_0_color-mix(in_oklch,var(--accent)_60%,transparent),inset_0_-1px_0_color-mix(in_oklch,var(--accent)_60%,transparent)]': cell.inRange,
                  'opacity-30': cell.inRange && picking,
                  'opacity-[0.34]': cell.inRange && !picking,
                  'rounded-[9px] opacity-0': !cell.isEdge && !cell.inRange,
                }"
              ></span>
              <span class="relative z-[2]">{{ cell.dayOfMonth }}<span
                v-if="cell.isToday"
                class="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full"
                :class="cell.isEdge ? 'bg-ink' : 'bg-[var(--accent)]'"
              ></span></span>
            </button>
          </template>
        </div>
      </div>

      <div class="flex items-center justify-between gap-[14px] border-t border-line pt-[15px]">
        <div>
          <div class="text-[22px] font-extrabold tabular-nums tracking-[-0.02em]"><b class="text-[var(--accent)]">{{ formatNumber(animatedPlays) }}</b> {{ totals.plays === 1 ? "play" : "plays" }}</div>
          <div class="mt-px text-[12px] text-faint">{{ formatDuration(totals.seconds) }} &middot; {{ rangeLabel }}</div>
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
        :style="{ left: `${tip.x}px`, top: `${tip.y}px`, transform: 'translate(-50%, calc(-100% - 9px))' }"
      >
        <b class="text-[12px] font-extrabold tracking-[-0.01em] text-text">{{ tip.title }}</b>
        <span class="text-[11px] font-bold tabular-nums" :class="tip.highlight ? 'text-[var(--accent)]' : 'text-faint'">{{ tip.detail }}</span>
      </div>
    </Transition>
  </div>
</template>
