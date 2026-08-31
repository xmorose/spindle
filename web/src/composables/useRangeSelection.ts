import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from "vue";
import { orderDates } from "@/lib/calendar";

export interface ShownRange { start: Date; end: Date }

export interface RangeSelection {
  from: Ref<Date>;
  to: Ref<Date>;
  picking: Ref<boolean>;
  pendingStart: Ref<Date | null>;
  previewEnd: Ref<Date | null>;
  shown: ComputedRef<ShownRange>;
  pressDay: (day: Date) => void;
  selectSpan: (a: Date, b: Date) => void;
}

export interface RangeSelectionOptions {
  initialFrom: Date;
  initialTo: Date;
  clamp: (d: Date) => Date;
}

function dayTimestampAt(x: number, y: number): number | null {
  const hit = document.elementFromPoint(x, y) as HTMLElement | null;
  const cell = hit?.closest("[data-ts]") as HTMLElement | null;
  return cell?.dataset.ts ? Number(cell.dataset.ts) : null;
}

export function useRangeSelection(options: RangeSelectionOptions): RangeSelection {
  const from = ref(options.initialFrom);
  const to = ref(options.initialTo);
  const picking = ref(false);
  const pendingStart = ref<Date | null>(null);
  const previewEnd = ref<Date | null>(null);

  let dragging = false;
  let dragMoved = false;
  let lastHoveredTs: number | null = null;

  const shown = computed<ShownRange>(() => {
    if (picking.value && pendingStart.value) {
      const [start, end] = orderDates(pendingStart.value, previewEnd.value ?? pendingStart.value);
      return { start, end };
    }
    return { start: from.value, end: to.value };
  });

  function reset() {
    picking.value = false;
    pendingStart.value = null;
    previewEnd.value = null;
    dragging = false;
    dragMoved = false;
    lastHoveredTs = null;
  }

  function commit(a: Date, b: Date) {
    const [start, end] = orderDates(options.clamp(a), options.clamp(b));
    from.value = start;
    to.value = end;
    reset();
  }

  function pressDay(day: Date) {
    if (picking.value && pendingStart.value) {
      commit(pendingStart.value, day);
      return;
    }
    pendingStart.value = day;
    previewEnd.value = null;
    picking.value = true;
    dragging = true;
    dragMoved = false;
    lastHoveredTs = day.getTime();
  }

  function onPointerMove(event: PointerEvent) {
    if (!picking.value) return;
    const ts = dayTimestampAt(event.clientX, event.clientY);
    if (ts === null) return;
    if (dragging && ts !== lastHoveredTs) {
      dragMoved = true;
      lastHoveredTs = ts;
    }
    if (previewEnd.value?.getTime() !== ts) previewEnd.value = new Date(ts);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    if (dragMoved && pendingStart.value && previewEnd.value) commit(pendingStart.value, previewEnd.value);
  }

  onMounted(() => {
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  });
  onBeforeUnmount(() => {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  });

  return { from, to, picking, pendingStart, previewEnd, shown, pressDay, selectSpan: commit };
}
