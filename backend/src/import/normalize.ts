function base(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")

    // Common letter equivalents
    .replace(/[ı]/g, "i")
    .replace(/[ß]/g, "ss")
    .replace(/[æ]/g, "ae")
    .replace(/[œ]/g, "oe")
    .replace(/[ø]/g, "o")
    .replace(/[ł]/g, "l")
    .replace(/[đ]/g, "d")
    .replace(/[ð]/g, "d")
    .replace(/[þ]/g, "th")
    .replace(/[ħ]/g, "h")
    .replace(/[ŋ]/g, "n")

    // Cyrillic lookalikes
    .replace(/[а]/g, "a")
    .replace(/[е]/g, "e")
    .replace(/[о]/g, "o")
    .replace(/[р]/g, "r")
    .replace(/[с]/g, "s")
    .replace(/[х]/g, "x")
    .replace(/[у]/g, "y");
}

export function fuzzyTitleKey(s: string): string {
  return base(s)
    .replace(/\b(the|a|an|of|or|and)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
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
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, "")
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

export function matchKey(artist: string, title: string): string {
  return `${normArtist(artist)} ${normTitle(title)}`;
}
