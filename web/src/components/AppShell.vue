<script setup lang="ts">
import SideNav from "./SideNav.vue";
import RangeBar from "./RangeBar.vue";
import PlayerBar from "./PlayerBar.vue";
import { computed, ref, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useRouter, useRoute } from "vue-router";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const fixedLabel = computed(() => (route.meta.fixedRange as string | undefined) ?? null);
const navOpen = ref(false);
watch(() => route.fullPath, () => { navOpen.value = false; });
async function logout() {
  await auth.logout();
  router.push("/login");
}
</script>

<template>
  <div class="min-h-screen md:grid md:grid-cols-[210px_1fr]">
    <div v-if="navOpen" class="fixed inset-0 z-40 bg-[oklch(0.1_0.02_50/0.6)] md:hidden" @click="navOpen = false"></div>
    <aside
      class="fixed inset-y-0 left-0 z-50 w-[210px] border-r border-line bg-[oklch(0.185_0.013_60)] transition-transform duration-300 ease-out md:static md:z-auto md:translate-x-0"
      :class="navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
    >
      <SideNav />
    </aside>
    <div class="flex min-w-0 flex-col">
      <header class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line/60 bg-[color-mix(in_oklch,var(--color-bg),transparent_10%)] px-4 py-4 backdrop-blur sm:px-8">
        <div class="flex min-w-0 items-center gap-3">
          <button class="-ml-1 flex-none rounded-lg p-1.5 text-muted transition-colors hover:text-text md:hidden" @click="navOpen = true" aria-label="Open menu">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <RangeBar v-if="!fixedLabel" />
          <span v-else class="label truncate">{{ fixedLabel }}</span>
        </div>
        <button
          class="flex-none rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-muted transition-colors duration-150 hover:bg-surface hover:text-text"
          @click="logout">Sign out</button>
      </header>
      <main class="min-w-0 flex-1 px-4 pb-28 pt-7 sm:px-8"><RouterView /></main>
    </div>
    <PlayerBar />
  </div>
</template>
