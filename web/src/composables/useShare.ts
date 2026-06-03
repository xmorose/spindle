import { ref } from "vue";
import { api } from "@/api/client";
import type { CreateShareRequest } from "@/api/types";

export const shareToast = ref<{ message: string; tone: "ok" | "error" } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function flash(message: string, tone: "ok" | "error") {
  shareToast.value = { message, tone };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { shareToast.value = null; }, 3500);
}

/** Creates a 24h share, copies the link to the clipboard, and flashes a toast. */
export async function createShareLink(req: CreateShareRequest): Promise<string | null> {
  if (!req.trackIds.length) return null;
  try {
    const { token } = await api.createShare(req);
    if (!token) { flash("Teilen fehlgeschlagen", "error"); return null; }
    const url = `${window.location.origin}/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Link kopiert · gilt 24 h", "ok");
    } catch {
      // Clipboard blocked (e.g. no HTTPS) — show the link so it can be copied manually.
      flash(url, "ok");
    }
    return url;
  } catch {
    flash("Teilen fehlgeschlagen", "error");
    return null;
  }
}
