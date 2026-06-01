function base(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function normArtist(s: string): string {
  return base(s).replace(/[^a-z0-9]+/g, " ").trim();
}

export function normTitle(s: string): string {
  return base(s)
    .replace(/[([]\s*(feat|ft|with)\.?[^)\]]*[)\]]/g, " ")
    .replace(/\s-\s.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchKey(artist: string, title: string): string {
  return `${normArtist(artist)} ${normTitle(title)}`;
}
