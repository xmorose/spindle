import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Range, RangeParams } from "@/api/types";
import type { DateWindow } from "@/lib/ranges";

const KEY = "spindle.range";
const PRESETS: Range[] = ["7d", "30d", "year", "all"];

interface Persisted { mode: "preset" | "custom"; preset: Range; custom: DateWindow | null; }

function initial(): Persisted {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    if ((PRESETS as string[]).includes(raw)) return { mode: "preset", preset: raw as Range, custom: null };
    try {
      const p = JSON.parse(raw) as Persisted;
      const validPreset = (PRESETS as string[]).includes(p?.preset);
      const validMode = p?.mode === "preset" || p?.mode === "custom";
      if (validPreset && validMode) {
        const custom = p.custom && typeof p.custom.from === "number" && typeof p.custom.to === "number" ? p.custom : null;
        return { mode: custom ? p.mode : "preset", preset: p.preset, custom };
      }
    } catch {}
  }
  return { mode: "preset", preset: "30d", custom: null };
}

export const useRangeStore = defineStore("range", () => {
  const init = initial();
  const mode = ref<"preset" | "custom">(init.mode);
  const preset = ref<Range>(init.preset);
  const custom = ref<DateWindow | null>(init.custom);

  function persist() {
    localStorage.setItem(KEY, JSON.stringify({ mode: mode.value, preset: preset.value, custom: custom.value }));
  }
  function setPreset(r: Range): void { preset.value = r; mode.value = "preset"; persist(); }
  function setCustom(w: DateWindow): void { custom.value = w; mode.value = "custom"; persist(); }

  const params = computed<RangeParams>(() =>
    mode.value === "custom" && custom.value
      ? { from: custom.value.from, to: custom.value.to }
      : { range: preset.value },
  );

  const range = computed<Range>(() => preset.value);

  return { mode, preset, custom, params, range, setPreset, setCustom, setRange: setPreset };
});
