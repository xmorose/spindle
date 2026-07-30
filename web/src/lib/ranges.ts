export interface DateWindow { from: number; to: number }

const DAY = 86400;
const sec = (d: Date) => Math.floor(d.getTime() / 1000);

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

export type PresetId = "thisWeek" | "thisMonth" | "last90" | "ytd" | "lastYear";

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: "thisWeek", label: "This week" },
  { id: "thisMonth", label: "This month" },
  { id: "last90", label: "Last 90 days" },
  { id: "ytd", label: "Year to date" },
  { id: "lastYear", label: "Last year" },
];

export function presetWindow(id: PresetId, now: Date = new Date()): DateWindow {
  const nowSec = sec(now);
  switch (id) {
    case "thisWeek": return { from: sec(startOfWeekMonday(now)), to: nowSec };
    case "thisMonth": return { from: sec(new Date(now.getFullYear(), now.getMonth(), 1)), to: nowSec };
    case "last90": return { from: nowSec - 90 * DAY, to: nowSec };
    case "ytd": return { from: sec(new Date(now.getFullYear(), 0, 1)), to: nowSec };
    case "lastYear": {
      const y = now.getFullYear() - 1;
      return { from: sec(new Date(y, 0, 1)), to: sec(new Date(y, 11, 31, 23, 59, 59)) };
    }
  }
}

export function clampWindow(w: DateWindow, min: number, max: number): DateWindow {
  let from = Math.max(min, Math.min(w.from, max));
  let to = Math.max(min, Math.min(w.to, max));
  if (from > to) [from, to] = [to, from];
  return { from, to };
}
