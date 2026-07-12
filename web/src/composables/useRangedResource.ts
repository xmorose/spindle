import { ref, watch, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { useRangeStore } from "@/stores/range";
import { useUserStore } from "@/stores/user";
import type { RangeParams } from "@/api/types";

export interface RangedResource<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<unknown>;
  reload: () => void;
}

export function useRangedResource<T>(fetcher: (params: RangeParams) => Promise<T>): RangedResource<T> {
  const { params } = storeToRefs(useRangeStore());
  const { user } = storeToRefs(useUserStore());
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(true);
  const error = ref<unknown>(null);

  async function run(p: RangeParams) {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fetcher(p);
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  }

  watch([params, user], () => void run(params.value), { immediate: true });
  return { data, loading, error, reload: () => void run(params.value) };
}
