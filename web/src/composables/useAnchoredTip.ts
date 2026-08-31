import { ref, type Ref } from "vue";

export interface TipState {
  show: boolean;
  x: number;
  y: number;
  title: string;
  detail: string;
  highlight: boolean;
}

export interface AnchoredTip {
  tip: Ref<TipState>;
  showTip: (target: HTMLElement, title: string, detail: string, highlight: boolean) => void;
  hideTip: () => void;
}

export function useAnchoredTip(host: Ref<HTMLElement | null>): AnchoredTip {
  const tip = ref<TipState>({ show: false, x: 0, y: 0, title: "", detail: "", highlight: false });

  function showTip(target: HTMLElement, title: string, detail: string, highlight: boolean) {
    const container = host.value;
    if (!container) return;
    const hostRect = container.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    tip.value = {
      show: true,
      x: rect.left - hostRect.left + rect.width / 2,
      y: rect.top - hostRect.top,
      title,
      detail,
      highlight,
    };
  }

  function hideTip() {
    tip.value = { ...tip.value, show: false };
  }

  return { tip, showTip, hideTip };
}
