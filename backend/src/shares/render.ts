import type { ShareKind } from "./store.js";

// Resolved share payload — identical shape to the SPA's `PublicShare` type, so it
// can be inlined verbatim as `window.__SHARE__` and consumed without transform.
export interface ShareTrackData {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  hasCover: boolean;
}
export interface ShareData {
  kind: ShareKind;
  label: string | null;
  expiresAt: number;
  tracks: ShareTrackData[];
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(s: string): string { return s.replace(/[&<>"']/g, (c) => ESC[c]); }
// JSON for an inline <script>; only `<` needs escaping to avoid closing the tag early.
function jsonScript(obj: unknown): string { return JSON.stringify(obj).replace(/</g, "\\u003c"); }

// Mirrors the SPA's cleanArtist (web/src/lib/format.ts) so the static page reads the same.
function cleanArtist(name: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of name.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!seen.has(part)) { seen.add(part); out.push(part); }
  }
  return out.join(", ");
}

function streamPath(token: string, id: string): string {
  return `/api/public/share/${encodeURIComponent(token)}/stream/${encodeURIComponent(id)}`;
}
function coverPath(token: string, id: string, size: number): string {
  return `/api/public/share/${encodeURIComponent(token)}/cover/${encodeURIComponent(id)}?size=${size}`;
}

function heading(s: ShareData): string {
  if (s.label) return s.label;
  return s.tracks.length === 1 ? s.tracks[0].title : `${s.tracks.length} Songs`;
}
function subheading(s: ShareData): string {
  if (!s.tracks.length) return "";
  if (s.kind === "queue") return "Mixtape";
  return cleanArtist(s.tracks[0].artist);
}
function hoursLeft(expiresAt: number, nowSec: number): number {
  return Math.max(0, Math.ceil((expiresAt - nowSec) / 3600));
}

// Self-contained styling for the no-JS fallback. Every color carries a hex fallback
// before its oklch() value so it renders on engines without oklch support. Scoped to
// #share-fb (plus a minimal body reset) so it never overrides the SPA once it mounts —
// the body font deliberately stays the SPA's, not system-ui.
const STYLE = `
body{margin:0;background:#221f1c;background:oklch(0.205 0.014 60);}
#share-fb{min-height:100vh;min-height:100dvh;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:40px 20px;color:#f5f2ec;color:oklch(0.97 0.008 85);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;}
#share-fb .card{width:100%;max-width:420px;display:flex;flex-direction:column;align-items:center;text-align:center;}
#share-fb .vinyl{position:relative;width:240px;height:240px;}
#share-fb .disc{position:absolute;inset:0;border-radius:50%;background:repeating-radial-gradient(circle at center,#2b2722 0 1.2px,#16120d 1.2px 2.4px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),0 12px 34px rgba(0,0,0,.45);}
#share-fb .art{position:absolute;inset:28%;width:44%;height:44%;border-radius:50%;object-fit:cover;box-shadow:0 0 0 1px rgba(0,0,0,.45);}
#share-fb .hole{position:absolute;left:50%;top:50%;width:9%;height:9%;transform:translate(-50%,-50%);border-radius:50%;background:#221f1c;background:oklch(0.205 0.014 60);}
#share-fb h1{margin:28px 0 2px;font-size:24px;font-weight:800;letter-spacing:-.01em;line-height:1.2;}
#share-fb .artist{font-size:14px;color:#b9b2a7;color:oklch(0.80 0.012 78);}
#share-fb audio{width:100%;margin-top:24px;}
#share-fb .list{width:100%;margin-top:24px;display:flex;flex-direction:column;gap:16px;}
#share-fb .row{text-align:left;}
#share-fb .row .t{font-size:14px;font-weight:600;}
#share-fb .row .a{font-size:12px;margin-bottom:6px;color:#9a9389;color:oklch(0.67 0.014 72);}
#share-fb .row audio{margin-top:0;}
#share-fb .foot{margin-top:36px;display:flex;flex-direction:column;gap:4px;align-items:center;}
#share-fb .foot .exp{font-size:11px;color:#9a9389;color:oklch(0.67 0.014 72);}
#share-fb .foot .brand{font-size:12px;font-weight:800;letter-spacing:-.01em;color:#b9b2a7;color:oklch(0.80 0.012 78);}
`.trim();

function vinyl(s: ShareData, token: string): string {
  const t0 = s.tracks[0];
  const art = t0.hasCover ? `<img class="art" src="${esc(coverPath(token, t0.id, 600))}" alt="" />` : "";
  return `<div class="vinyl"><div class="disc"></div>${art}<div class="hole"></div></div>`;
}

function fallbackBody(s: ShareData, token: string, nowSec: number): string {
  let player: string;
  if (s.tracks.length === 1) {
    player = `<audio controls preload="metadata" src="${esc(streamPath(token, s.tracks[0].id))}"></audio>`;
  } else {
    const rows = s.tracks.map((t) =>
      `<div class="row"><div class="t">${esc(t.title)}</div><div class="a">${esc(cleanArtist(t.artist))}</div>` +
      `<audio controls preload="none" src="${esc(streamPath(token, t.id))}"></audio></div>`,
    ).join("");
    player = `<div class="list">${rows}</div>`;
  }
  const title = s.tracks.length === 1 ? esc(s.tracks[0].title) : esc(heading(s));
  const artist = s.tracks.length === 1 ? esc(cleanArtist(s.tracks[0].artist)) : esc(subheading(s));
  return `<div id="share-fb"><div class="card">${vinyl(s, token)}<h1>${title}</h1>` +
    `<div class="artist">${artist}</div>${player}` +
    `<div class="foot"><span class="exp">Läuft in ${hoursLeft(s.expiresAt, nowSec)} h ab</span>` +
    `<span class="brand">Spindle</span></div></div></div>`;
}

// Open Graph / Twitter tags (so chat apps render a real preview card), inline critical
// CSS, and the inlined share data the SPA hydrates from.
function headExtras(s: ShareData, token: string, origin: string): string {
  const t0 = s.tracks[0];
  const title = esc(heading(s));
  const desc = esc(subheading(s) || "Listen on Spindle");
  const img = t0.hasCover ? esc(`${origin}${coverPath(token, t0.id, 600)}`) : "";
  const audio = esc(`${origin}${streamPath(token, t0.id)}`);
  const tags = [
    `<meta property="og:type" content="music.song" />`,
    `<meta property="og:site_name" content="Spindle" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:audio" content="${audio}" />`,
    img ? `<meta property="og:image" content="${img}" />` : "",
    `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
    img ? `<meta name="twitter:image" content="${img}" />` : "",
    `<meta name="theme-color" content="#221f1c" />`,
  ].filter(Boolean).join("");
  return `${tags}<style>${STYLE}</style><script>window.__SHARE__=${jsonScript(s)}</script>`;
}

/**
 * Render the full share page. When `shell` (the built index.html) is provided, the page
 * is the SPA shell with the fallback injected into #app, OG/meta + critical CSS in <head>,
 * and the share data inlined — so the real Vue UI enhances on top when JS loads, and the
 * static native-audio player remains if it doesn't. Without a shell, a standalone static
 * page is returned (no SPA enhancement, still fully functional).
 */
export function renderSharePage(shell: string | null, s: ShareData, token: string, origin: string, nowSec: number): string {
  const extras = headExtras(s, token, origin);
  const body = fallbackBody(s, token, nowSec);
  const title = `${esc(heading(s))} · Spindle`;
  if (shell) {
    return shell
      .replace("<title>Spindle</title>", `<title>${title}</title>`)
      .replace("</head>", `${extras}</head>`)
      .replace('<div id="app"></div>', `<div id="app">${body}</div>`);
  }
  return `<!doctype html><html lang="de"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width,initial-scale=1" />` +
    `<link rel="icon" type="image/svg+xml" href="/favicon.svg" /><title>${title}</title>` +
    `${extras}</head><body>${body}</body></html>`;
}

export function renderExpiredPage(): string {
  const style = `body{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;` +
    `text-align:center;padding:20px;background:#221f1c;background:oklch(0.205 0.014 60);` +
    `color:#f5f2ec;color:oklch(0.97 0.008 85);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}` +
    `h1{font-size:24px;font-weight:800;margin:0 0 8px;}` +
    `p{font-size:14px;margin:0;color:#9a9389;color:oklch(0.67 0.014 72);}` +
    `.brand{margin-top:28px;font-size:12px;font-weight:800;color:#b9b2a7;color:oklch(0.80 0.012 78);}`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width,initial-scale=1" />` +
    `<title>Link abgelaufen · Spindle</title><meta name="theme-color" content="#221f1c" />` +
    `<style>${style}</style></head><body><div><h1>Dieser Link ist abgelaufen</h1>` +
    `<p>Geteilte Links gelten 24 Stunden.</p><div class="brand">Spindle</div></div></body></html>`;
}
