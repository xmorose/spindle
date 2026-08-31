export const DAY_MS = 86_400_000;

export const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad2 = (n: number) => String(n).padStart(2, "0");

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

export function daysInMonth(d: Date): number {
  return endOfMonth(d).getDate();
}

export function leadingBlanks(d: Date): number {
  return (startOfMonth(d).getDay() + 6) % 7;
}

export function clampDate(d: Date, min: Date, max: Date): Date {
  if (d < min) return min;
  if (d > max) return max;
  return d;
}

export function orderDates(a: Date, b: Date): [Date, Date] {
  return a <= b ? [a, b] : [b, a];
}

export function toUnixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

export function dayFromUnixSeconds(seconds: number): Date {
  return startOfDay(new Date(seconds * 1000));
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}`;
}

export function monthKeyOfDayKey(key: string): string {
  return key.slice(0, 7);
}

export function yearOfMonthKey(key: string): number {
  return Number(key.slice(0, 4));
}

export function dateFromDayBucket(bucket: number): Date {
  const shifted = new Date(bucket * DAY_MS);
  return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

export function dayKeyFromDayBucket(bucket: number): string {
  return dayKey(dateFromDayBucket(bucket));
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatFullDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
