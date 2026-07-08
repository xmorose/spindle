<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useUserStore } from "@/stores/user";

const store = useUserStore();
const { users, user } = storeToRefs(store);
const open = ref(false);

function pick(name: string): void {
  store.setUser(name);
  open.value = false;
}
</script>

<template>
  <div v-if="users.length > 1" class="relative">
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-2 pr-3 text-[13px] font-semibold text-muted transition-colors duration-150 hover:text-text"
      :class="open ? 'text-text' : ''"
      @click="open = !open"
      aria-haspopup="listbox"
      :aria-expanded="open"
    >
      <span class="grid h-5 w-5 flex-none place-items-center rounded-full" :style="{ background: 'var(--accent-soft)' }">
        <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" :style="{ color: 'var(--accent)' }" aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </svg>
      </span>
      <span class="max-w-[9rem] truncate">{{ user }}</span>
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 flex-none text-faint transition-transform duration-150" :class="open ? 'rotate-180' : ''" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div v-if="open" class="fixed inset-0 z-40" @click="open = false"></div>
    <div
      v-if="open"
      class="absolute right-0 z-50 mt-2 max-h-[60vh] min-w-[12rem] overflow-y-auto rounded-xl border border-line bg-[oklch(0.205_0.014_60)] p-1 shadow-xl shadow-black/30"
      role="listbox"
    >
      <button
        v-for="u in users" :key="u"
        type="button"
        class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors duration-100"
        :class="u === user ? 'text-text' : 'text-muted hover:bg-surface hover:text-text'"
        :style="u === user ? { background: 'var(--accent-soft)' } : {}"
        role="option"
        :aria-selected="u === user"
        @click="pick(u)"
      >
        <span class="h-1.5 w-1.5 flex-none rounded-full" :style="{ background: u === user ? 'var(--accent)' : 'transparent' }"></span>
        <span class="truncate">{{ u }}</span>
      </button>
    </div>
  </div>
</template>
