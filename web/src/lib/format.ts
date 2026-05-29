export function formatDuration(seconds: number): string {
  const totalMin = Math.floor(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function cleanArtist(name: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of name.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!seen.has(part)) { seen.add(part); out.push(part); }
  }
  return out.join(", ");
}
