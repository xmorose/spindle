<script setup lang="ts">
import { onMounted, ref } from "vue";
import { loadYears } from "@/lib/history";
import { yearWindow, type DateWindow } from "@/lib/ranges";

const props = defineProps<{ active: DateWindow | null }>();
const emit = defineEmits<{ (e: "pick", w: DateWindow): void }>();

const years = ref<number[]>([]);
const thisYear = new Date().getFullYear();
onMounted(async () => { years.value = await loadYears(); });

function isActive(y: number, sinceMode: boolean): boolean {
  const a = props.active;
  if (!a) return false;
  const w = yearWindow(y, sinceMode);
  return Math.abs(a.from - w.from) < 86400 && Math.abs(a.to - w.to) < 86400;
}
function pick(y: number, sinceMode: boolean) { emit("pick", yearWindow(y, sinceMode)); }
</script>

<template>
  <div class="flex flex-col gap-px">
    <div class="label px-3 pb-1.5 pt-2">Jump to a year</div>
    <div v-if="!years.length" class="px-3 py-2 text-[12px] font-semibold text-faint">Loading history...</div>
    <div v-for="y in years" :key="y" class="flex items-stretch gap-1">
      <button
        class="flex-1 cursor-pointer rounded-lg px-3 py-2 text-left text-[14px] font-bold tabular-nums tracking-[-0.01em] transition-colors duration-150"
        :class="isActive(y, false) ? 'text-text' : 'text-muted hover:bg-surface-2 hover:text-text'"
        :style="isActive(y, false) ? { background: 'var(--accent-soft)' } : {}"
        @click="pick(y, false)"
      >{{ y }}</button>
      <button
        v-if="y !== thisYear"
        class="flex flex-none cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] transition-colors duration-150"
        :class="isActive(y, true) ? 'text-text' : 'text-faint hover:bg-surface-2 hover:text-text'"
        :style="isActive(y, true) ? { background: 'var(--accent-soft)' } : {}"
        :aria-label="`${y} to today`"
        @click="pick(y, true)"
      >
        <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 5l7 7-7 7M4 12h16" /></svg>
        today
      </button>
    </div>
  </div>
</template>
