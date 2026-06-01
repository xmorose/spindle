<script setup lang="ts">
import { computed } from "vue";
import { api } from "@/api/client";
import { useRangedResource } from "@/composables/useRangedResource";
import { formatDuration, formatDate } from "@/lib/format";
import Spinner from "@/components/ui/Spinner.vue";

const res = useRangedResource((range) => api.sessions({ range, limit: 30 }));
const sessions = computed(() => res.data.value ?? []);
const firstLoad = computed(() => res.loading.value && res.data.value === null);
const isEmpty = computed(() => !res.loading.value && sessions.value.length === 0);
</script>

<template>
  <div class="py-2 rise">
    <h1 class="mb-6 text-2xl font-extrabold tracking-tight">Sessions</h1>

    <div v-if="firstLoad" class="grid min-h-[40vh] place-items-center"><Spinner /></div>

    <div v-else-if="isEmpty" class="py-16 text-center text-sm text-faint">No sessions yet — they appear once you have live listening.</div>

    <div v-else class="flex flex-col">
      <div v-for="(s, i) in sessions" :key="i" class="flex items-center gap-4 border-b border-line/40 py-3 last:border-0">
        <span class="tabular w-6 text-right text-xs font-bold text-faint">{{ i + 1 }}</span>
        <div class="flex-1">
          <div class="text-sm font-semibold">{{ formatDate(s.startedAt) }}</div>
          <div class="tabular text-xs text-faint">{{ s.trackCount }} tracks</div>
        </div>
        <span class="tabular text-sm font-bold" :style="{ color: 'var(--accent)' }">{{ formatDuration(s.seconds) }}</span>
      </div>
    </div>
  </div>
</template>
