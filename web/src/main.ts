import { createApp } from "vue";
import { createPinia } from "pinia";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/hanken-grotesk/800.css";
import "@fontsource/hanken-grotesk/900.css";
import "./styles/main.css";
import App from "./App.vue";
import { router } from "./router";
import { setAuthLostHandler } from "./api/client";
import { useAuthStore } from "./stores/auth";

const app = createApp(App);
app.use(createPinia());
app.use(router);

setAuthLostHandler(() => {
  const auth = useAuthStore();
  if (!auth.authenticated && router.currentRoute.value.path === "/login") return;
  auth.authenticated = false;
  const current = router.currentRoute.value;
  if (current.path === "/login" || (current.meta as { public?: boolean }).public) return;
  void router.replace({ path: "/login", query: { next: current.fullPath } });
});

app.mount("#app");
