<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const password = ref("");
const error = ref(false);
const busy = ref(false);

async function submit() {
  error.value = false;
  busy.value = true;
  try {
    const ok = await auth.login(password.value);
    if (ok) {
      const next = typeof route.query.next === "string" ? route.query.next : "/";
      router.push(next);
    } else {
      error.value = true;
    }
  } catch {
    error.value = true;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="grid min-h-screen place-items-center px-4">
    <form class="w-full max-w-xs" @submit.prevent="submit">
      <div class="mb-7 flex items-center gap-2 text-lg font-extrabold tracking-tight">
        <span class="h-[18px] w-[18px] rounded-full border-2" :style="{ borderColor: 'var(--accent)' }" />
        Spindle
      </div>
      <label class="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-faint">Password</label>
      <input
        v-model="password" type="password" autofocus autocomplete="current-password"
        class="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
      />
      <p v-if="error" class="mt-2 text-xs text-[oklch(0.7_0.16_25)]">Incorrect password.</p>
      <button
        type="submit" :disabled="busy"
        class="mt-4 w-full rounded-lg py-2.5 text-sm font-bold text-[oklch(0.2_0.03_50)] disabled:opacity-60"
        :style="{ background: 'var(--accent)' }"
      >{{ busy ? "Signing in…" : "Sign in" }}</button>
    </form>
  </div>
</template>
