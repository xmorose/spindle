function base(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ø/g, "o")
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/ħ/g, "h")
    .replace(/ŋ/g, "n");
}

export function normArtist(s: string): string {
  return base(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function normTitle(s: string): string {
  const b = base(s);
  if (/^untitled\s*[([]/.test(b)) {
    return b.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }
  return b
    .replace(/[([]\s*(feat|ft|featuring|with|prod)\.?[^)\]]*[)\]]/g, " ")
    .replace(/[([][^)\]]*\b(remix|edit|mix|version|acoustic|live|remaster(ed)?|bootleg|vip|instrumental|extended|radio|slowed|reverb|sped|flip)\b[^)\]]*[)\]]/g, " ")
    .replace(/\s(feat|ft|featuring)\.?\s.*$/, "")
    .replace(/\s-\s.*$/, "")
    .replace(/\s\+.*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function fuzzyTitleKey(s: string): string {
  return normTitle(s)
    .replace(/\b(the|a|an|of|or|and)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function matchKey(artist: string, title: string): string {
  return `${normArtist(artist)} ${normTitle(title)}`;
}
