import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "@/api/client";

export const useAuthStore = defineStore("auth", () => {
  const authenticated = ref(false);
  const ready = ref(false);

  async function checkAuth(): Promise<void> {
    try {
      const { authenticated: a } = await api.me();
      authenticated.value = a;
    } catch {
      authenticated.value = false;
    } finally {
      ready.value = true;
    }
  }

  async function login(password: string): Promise<boolean> {
    const { authenticated: a } = await api.login(password);
    authenticated.value = a;
    return a;
  }

  async function logout(): Promise<void> {
    try { await api.logout(); } finally { authenticated.value = false; }
  }

  return { authenticated, ready, checkAuth, login, logout };
});
