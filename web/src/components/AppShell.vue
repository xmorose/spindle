<script setup lang="ts">
import SideNav from "./SideNav.vue";
import RangeBar from "./RangeBar.vue";
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
  <div class="grid min-h-screen grid-cols-[180px_1fr]">
    <aside class="border-r border-line/70 bg-[oklch(0.15_0.012_55)]">
      <SideNav />
    </aside>
    <div class="flex min-w-0 flex-col">
      <header class="flex items-center justify-between px-8 py-5">
        <RangeBar v-if="!fixedLabel" />
        <span v-else class="text-[12.5px] font-semibold text-faint">{{ fixedLabel }}</span>
        <button class="text-xs font-semibold text-faint hover:text-muted" @click="logout">Sign out</button>
      </header>
      <main class="min-w-0 flex-1 px-8 pb-12">
        <RouterView />
      </main>
    </div>
  </div>
</template>
