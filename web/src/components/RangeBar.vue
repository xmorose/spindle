<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { storeToRefs } from "pinia";
import { useRangeStore } from "@/stores/range";
import type { Range } from "@/api/types";
import type { DateWindow } from "@/lib/ranges";
import { formatRangeLabel } from "@/lib/format";
import CustomRangePanel from "@/components/CustomRangePanel.vue";

const store = useRangeStore();
const { mode, preset, custom } = storeToRefs(store);
const presets: { value: Range; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
];

const open = ref(false);
const wrap = ref<HTMLElement | null>(null);
const customLabel = computed(() => (custom.value ? formatRangeLabel(custom.value.from, custom.value.to) : "Custom"));
const isCustom = computed(() => mode.value === "custom");

function onDocClick(e: MouseEvent) { if (wrap.value && !wrap.value.contains(e.target as Node)) close(); }
function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
function close() {
  open.value = false;
  document.removeEventListener("mousedown", onDocClick);
  document.removeEventListener("keydown", onKey);
}
function toggle() {
  if (open.value) { close(); return; }
  open.value = true;
  document.addEventListener("mousedown", onDocClick);
  document.addEventListener("keydown", onKey);
}
function pickPreset(r: Range) { store.setPreset(r); }
function onApply(w: DateWindow) { store.setCustom(w); close(); }
onBeforeUnmount(close);
</script>

<template>
  <div ref="wrap" class="relative flex items-center gap-2.5">
    <span class="label hidden sm:inline" style="font-size: 11px">Range</span>
    <div class="inline-flex rounded-full border border-line bg-surface p-1">
      <button v-for="r in presets" :key="r.value" @click="pickPreset(r.value)"
        class="rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200"
        :class="!isCustom && preset === r.value ? 'text-[oklch(0.22_0.03_55)] shadow-sm' : 'text-muted hover:bg-surface-2 hover:text-text'"
        :style="!isCustom && preset === r.value ? { background: 'var(--accent)' } : {}">{{ r.label }}</button>

      <button @click="toggle"
        class="tabular flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200"
        :class="isCustom ? 'text-[oklch(0.22_0.03_55)] shadow-sm' : 'text-muted hover:bg-surface-2 hover:text-text'"
        :style="isCustom ? { background: 'var(--accent)' } : {}" aria-haspopup="dialog" :aria-expanded="open">
        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
        {{ customLabel }}
      </button>
    </div>

    <div v-if="open" class="rise absolute left-0 top-[calc(100%+8px)] z-30">
      <CustomRangePanel :initial="custom" @apply="onApply" @cancel="close" />
    </div>
  </div>
</template>
