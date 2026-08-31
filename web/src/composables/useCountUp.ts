import { onBeforeUnmount, ref, watch, type Ref } from "vue";

export function useCountUp(source: () => number, durationMs = 420): Ref<number> {
  const shown = ref(0);
  let frame = 0;

  watch(
    source,
    (target) => {
      cancelAnimationFrame(frame);
      const start = shown.value;
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs);
        shown.value = Math.round(start + (target - start) * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => cancelAnimationFrame(frame));
  return shown;
}
