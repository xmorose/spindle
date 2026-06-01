function base(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function normArtist(s: string): string {
  return base(s).replace(/[^a-z0-9]+/g, " ").trim();
}

export function normTitle(s: string): string {
  return base(s)
    .replace(/[([]\s*(feat|ft|featuring|with|prod)\.?[^)\]]*[)\]]/g, " ")
    .replace(/[([][^)\]]*\b(remix|edit|mix|version|acoustic|live|remaster(ed)?|bootleg|vip|instrumental|extended|radio|slowed|reverb|sped|flip)\b[^)\]]*[)\]]/g, " ")
    .replace(/\s(feat|ft|featuring)\.?\s.*$/, "")
    .replace(/\s-\s.*$/, "")
    .replace(/\s\+.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchKey(artist: string, title: string): string {
  return `${normArtist(artist)} ${normTitle(title)}`;
}
