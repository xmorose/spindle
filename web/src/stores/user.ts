import { defineStore } from "pinia";
import { ref } from "vue";
import { api, setCurrentUser } from "@/api/client";

const KEY = "spindle.user";

export const useUserStore = defineStore("user", () => {
  const stored = localStorage.getItem(KEY) ?? "";
  const users = ref<string[]>([]);
  const defaultUser = ref<string>("");
  const user = ref<string>(stored);
  setCurrentUser(stored || undefined);

  function setUser(name: string): void {
    user.value = name;
    localStorage.setItem(KEY, name);
    setCurrentUser(name || undefined);
  }

  async function init(): Promise<void> {
    try {
      const res = await api.users();
      users.value = res.users;
      defaultUser.value = res.default;
      if (!res.users.includes(user.value)) setUser(res.default);
    } catch {
    }
  }

  return { users, defaultUser, user, setUser, init };
});
