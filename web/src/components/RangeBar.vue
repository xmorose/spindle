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
const presets: { value: Range; label: string; wide?: boolean }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days", wide: true },
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
];

const open = ref(false);
const menuOpen = ref(false);
const wrap = ref<HTMLElement | null>(null);
const customLabel = computed(() => (custom.value ? formatRangeLabel(custom.value.from, custom.value.to) : "Custom"));
const isCustom = computed(() => mode.value === "custom");
const activeLabel = computed(() =>
  isCustom.value ? customLabel.value : presets.find((p) => p.value === preset.value)?.label ?? "Range",
);

function onDocClick(e: MouseEvent) { if (wrap.value && !wrap.value.contains(e.target as Node)) close(); }
function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
function detach() {
  document.removeEventListener("mousedown", onDocClick);
  document.removeEventListener("keydown", onKey);
}
function attach() {
  document.addEventListener("mousedown", onDocClick);
  document.addEventListener("keydown", onKey);
}
function close() {
  open.value = false;
  menuOpen.value = false;
  detach();
}
function toggle() {
  if (open.value) { close(); return; }
  menuOpen.value = false;
  open.value = true;
  attach();
}
function toggleMenu() {
  if (menuOpen.value) { close(); return; }
  open.value = false;
  menuOpen.value = true;
  attach();
}
function pickPreset(r: Range) { store.setPreset(r); close(); }
function onApply(w: DateWindow) { store.setCustom(w); close(); }
onBeforeUnmount(close);
</script>

<template>
  <div ref="wrap" class="relative flex min-w-0 items-center gap-2.5">
    <span class="label-sm hidden lg:inline">Range</span>

    <button
      class="tabular flex max-w-[9.5rem] items-center gap-1.5 truncate rounded-full border border-line bg-surface py-1.5 pl-3.5 pr-2.5 text-[13px] font-semibold text-text sm:hidden"
      @click="toggleMenu" aria-haspopup="menu" :aria-expanded="menuOpen"
    >
      <span class="truncate">{{ activeLabel }}</span>
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 flex-none text-faint transition-transform duration-150" :class="menuOpen ? 'rotate-180' : ''"
        fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div class="hidden rounded-full border border-line bg-surface p-1 sm:inline-flex">
      <button v-for="r in presets" :key="r.value" @click="pickPreset(r.value)"
        class="rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200"
        :class="[
          r.wide ? 'hidden lg:block' : '',
          !isCustom && preset === r.value ? 'text-[oklch(0.22_0.03_55)] shadow-sm' : 'text-muted hover:bg-surface-2 hover:text-text',
        ]"
        :style="!isCustom && preset === r.value ? { background: 'var(--accent)' } : {}">{{ r.label }}</button>

      <button @click="toggle"
        class="tabular flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200"
        :class="isCustom ? 'text-[oklch(0.22_0.03_55)] shadow-sm' : 'text-muted hover:bg-surface-2 hover:text-text'"
        :style="isCustom ? { background: 'var(--accent)' } : {}" aria-haspopup="dialog" :aria-expanded="open">
        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
        <span class="truncate" :class="isCustom ? 'max-w-[8.5rem]' : 'hidden lg:inline'">{{ customLabel }}</span>
      </button>
    </div>

    <div v-if="menuOpen" class="rise absolute left-0 top-[calc(100%+8px)] z-30 w-48 rounded-xl border border-line bg-surface p-1 shadow-xl sm:hidden">
      <button v-for="r in presets" :key="r.value" @click="pickPreset(r.value)"
        class="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors"
        :class="!isCustom && preset === r.value ? 'text-text' : 'text-muted hover:bg-surface-2 hover:text-text'"
        :style="!isCustom && preset === r.value ? { background: 'var(--accent-soft)' } : {}">{{ r.label }}</button>
      <button @click="toggle"
        class="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors"
        :class="isCustom ? 'text-text' : 'text-muted hover:bg-surface-2 hover:text-text'"
        :style="isCustom ? { background: 'var(--accent-soft)' } : {}">{{ isCustom ? customLabel : 'Custom range' }}</button>
    </div>

    <div v-if="open" class="rise absolute left-0 top-[calc(100%+8px)] z-30">
      <CustomRangePanel :initial="custom" @apply="onApply" @cancel="close" />
    </div>
  </div>
</template>
