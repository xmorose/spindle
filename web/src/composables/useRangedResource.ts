import { ref, watch, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { useRangeStore } from "@/stores/range";
import type { Range } from "@/api/types";

export interface RangedResource<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<unknown>;
  reload: () => void;
}

export function useRangedResource<T>(fetcher: (range: Range) => Promise<T>): RangedResource<T> {
  const { range } = storeToRefs(useRangeStore());
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(true);
  const error = ref<unknown>(null);

  async function run(r: Range) {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fetcher(r);
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  }

  watch(range, (r) => void run(r), { immediate: true });
  return { data, loading, error, reload: () => void run(range.value) };
}
