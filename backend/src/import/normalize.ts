function base(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normArtist(s: string): string {
  return base(s)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function normTitle(s: string): string {
  const original = base(s);

  if (/^untitled\s*\(.*\)$/i.test(original)) {
    return original
      .replace(/[^\p{L}\p{N}]+/gu, "")
      .trim();
  }

  return original
    .replace(/[([]\s*(feat|ft|featuring|with|prod)\.?[^)\]]*[)\]]/g, " ")
    .replace(/[([][^)\]]*\b(remix|edit|mix|version|acoustic|remaster(ed)?|bootleg|vip|instrumental|extended|radio|slowed|reverb|sped|flip)\b[^)\]]*[)\]]/g, " ")
    .replace(/\s(feat|ft|featuring)\.?\s.*$/, "")
    .replace(/\s-\s.*$/, "")
    .replace(/\s\+.*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function matchKey(
  artist: string,
  title: string
): string {
  return `${normArtist(artist)} ${normTitle(title)}`;
}
