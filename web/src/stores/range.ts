import { defineStore } from "pinia";
import { ref } from "vue";
import type { Range } from "@/api/types";

const KEY = "spindle.range";
const VALID: Range[] = ["7d", "30d", "year", "all"];

function initial(): Range {
  const stored = localStorage.getItem(KEY);
  return stored && (VALID as string[]).includes(stored) ? (stored as Range) : "30d";
}

export const useRangeStore = defineStore("range", () => {
  const range = ref<Range>(initial());

  function setRange(r: Range): void {
    range.value = r;
    localStorage.setItem(KEY, r);
  }

  return { range, setRange };
});
