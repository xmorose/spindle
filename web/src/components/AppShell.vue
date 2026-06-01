<script setup lang="ts">
import SideNav from "./SideNav.vue";
import RangeBar from "./RangeBar.vue";
import PlayerBar from "./PlayerBar.vue";
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useRouter, useRoute } from "vue-router";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const fixedLabel = computed(() => (route.meta.fixedRange as string | undefined) ?? null);
async function logout() {
  await auth.logout();
  router.push("/login");
}
</script>

<template>
  <div class="grid min-h-screen grid-cols-[210px_1fr]">
    <aside class="border-r border-line bg-[oklch(0.185_0.013_60)]">
      <SideNav />
    </aside>
    <div class="flex min-w-0 flex-col">
      <header class="sticky top-0 z-10 flex items-center justify-between border-b border-line/60 bg-[color-mix(in_oklch,var(--color-bg),transparent_10%)] px-8 py-4 backdrop-blur">
        <RangeBar v-if="!fixedLabel" />
        <span v-else class="label">{{ fixedLabel }}</span>
        <button
          class="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-muted transition-colors duration-150 hover:border-line hover:bg-surface hover:text-text"
          @click="logout">Sign out</button>
      </header>
      <main class="min-w-0 flex-1 px-8 pb-28 pt-7">
        <RouterView />
      </main>
    </div>
    <PlayerBar />
  </div>
</template>
