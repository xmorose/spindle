import { formatNumber } from "./format";

export interface WrappedCardData {
  year: number;
  plays: number;
  seconds: number;
  distinctArtists: number;
  topArtist: string;
  coverUrl: string | null;
  tracks: { title: string; artist: string; plays: number }[];
  genre: string | null;
  accent: string;
}

const W = 1080;
const H = 1350;
const PAD = 84;

const BG = "oklch(0.205 0.014 60)";
const SURFACE = "oklch(0.245 0.015 60)";
const TEXT = "oklch(0.97 0.008 85)";
const MUTED = "oklch(0.80 0.012 78)";
const FAINT = "oklch(0.62 0.014 72)";
const LINE = "oklch(0.34 0.014 60)";

function font(weight: number, size: number) {
  return `${weight} ${size}px "Hanken Grotesk", system-ui, sans-serif`;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function hoursLabel(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  return hours >= 1 ? `${formatNumber(hours)} hours listened` : `${Math.round(seconds / 60)} minutes listened`;
}

export async function renderWrappedCard(data: WrappedCardData): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const cover = data.coverUrl ? await loadImage(data.coverUrl) : null;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  ctx.strokeStyle = data.accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(PAD + 16, PAD + 16, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.font = font(800, 34);
  ctx.fillText("Spindle", PAD + 48, PAD + 28);
  ctx.fillStyle = FAINT;
  ctx.font = font(700, 26);
  const wrapped = `WRAPPED ${data.year}`;
  ctx.save();
  ctx.letterSpacing = "4px";
  ctx.fillText(wrapped, W - PAD - ctx.measureText(wrapped).width, PAD + 27);
  ctx.restore();

  const coverSize = 320;
  const coverX = W - PAD - coverSize;
  const coverY = 196;
  if (cover) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, 28);
    ctx.clip();
    ctx.drawImage(cover, coverX, coverY, coverSize, coverSize);
    ctx.restore();
  } else {
    const cx = coverX + coverSize / 2;
    const cy = coverY + coverSize / 2;
    ctx.fillStyle = SURFACE;
    ctx.beginPath();
    ctx.arc(cx, cy, coverSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = data.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  const numRight = coverX - 56;
  ctx.fillStyle = FAINT;
  ctx.font = font(700, 26);
  ctx.save();
  ctx.letterSpacing = "3px";
  ctx.fillText("SONGS PLAYED", PAD, coverY + 52);
  ctx.restore();

  ctx.fillStyle = data.accent;
  let playsSize = 160;
  ctx.font = font(900, playsSize);
  const playsText = formatNumber(data.plays);
  while (ctx.measureText(playsText).width > numRight - PAD && playsSize > 72) {
    playsSize -= 8;
    ctx.font = font(900, playsSize);
  }
  const playsBaseline = coverY + 52 + playsSize * 0.92;
  ctx.fillText(playsText, PAD - 6, playsBaseline);

  ctx.fillStyle = MUTED;
  ctx.font = font(600, 34);
  const hoursBaseline = playsBaseline + 58;
  ctx.fillText(hoursLabel(data.seconds), PAD, hoursBaseline);

  const footerY = H - PAD + 8;

  let y = Math.max(coverY + coverSize, hoursBaseline) + 56;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();

  y += 58;
  ctx.fillStyle = FAINT;
  ctx.font = font(700, 26);
  ctx.save();
  ctx.letterSpacing = "3px";
  ctx.fillText("TOP ARTIST", PAD, y);
  ctx.restore();
  y += 70;
  ctx.fillStyle = TEXT;
  ctx.font = font(900, 62);
  ctx.fillText(truncate(ctx, data.topArtist, W - PAD * 2), PAD, y);

  y += 76;
  ctx.fillStyle = FAINT;
  ctx.font = font(700, 26);
  ctx.save();
  ctx.letterSpacing = "3px";
  ctx.fillText("ON REPEAT", PAD, y);
  ctx.restore();

  const rows = data.tracks.slice(0, 5);
  const listTop = y + 18;
  const listSpace = footerY - 46 - listTop;
  const rowH = rows.length ? Math.min(74, Math.max(52, listSpace / rows.length)) : 0;
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    const ry = listTop + (i + 1) * rowH - rowH * 0.28;
    ctx.fillStyle = data.accent;
    ctx.font = font(900, 36);
    ctx.fillText(String(i + 1), PAD, ry);

    const playsLabel = `${formatNumber(t.plays)} ${t.plays === 1 ? "play" : "plays"}`;
    ctx.font = font(600, 28);
    const playsW = ctx.measureText(playsLabel).width;
    ctx.fillStyle = FAINT;
    ctx.fillText(playsLabel, W - PAD - playsW, ry);

    const textX = PAD + 62;
    const maxW = W - PAD - playsW - 48 - textX;
    ctx.fillStyle = TEXT;
    ctx.font = font(800, 33);
    const title = truncate(ctx, t.title, maxW * 0.58);
    ctx.fillText(title, textX, ry);
    const titleW = ctx.measureText(title).width;
    const artistRoom = maxW - titleW - 16;
    if (artistRoom > 60) {
      ctx.fillStyle = FAINT;
      ctx.font = font(500, 28);
      ctx.fillText(truncate(ctx, t.artist, artistRoom), textX + titleW + 16, ry);
    }
  }

  const fy = footerY;
  ctx.fillStyle = FAINT;
  ctx.font = font(600, 26);
  const left = data.genre ? `mostly ${data.genre}` : `${formatNumber(data.distinctArtists)} artists`;
  ctx.fillText(left, PAD, fy);
  ctx.save();
  ctx.letterSpacing = "3px";
  ctx.font = font(700, 24);
  const right = "A YEAR IN SOUND";
  ctx.fillText(right, W - PAD - ctx.measureText(right).width, fy);
  ctx.restore();

  return canvas;
}

export function downloadCard(canvas: HTMLCanvasElement, year: number): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spindle-wrapped-${year}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, "image/png");
}
