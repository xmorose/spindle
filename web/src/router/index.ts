import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { resolveGuard } from "./guard";
import AppShell from "@/components/AppShell.vue";

const routes: RouteRecordRaw[] = [
  { path: "/login", name: "login", component: () => import("@/views/LoginView.vue"), meta: { public: true } },
  {
    path: "/",
    component: AppShell,
    children: [
      { path: "", name: "home", component: () => import("@/views/HomeView.vue") },
      { path: "tops", name: "tops", component: () => import("@/views/TopsView.vue") },
      { path: "all-time", name: "all-time", component: () => import("@/views/AllTimeView.vue"), meta: { fixedRange: "All-time" } },
      { path: "artists", name: "artists", component: () => import("@/views/ArtistsView.vue") },
      { path: "artists/:id", name: "artist", component: () => import("@/views/EntityDetailView.vue"), meta: { entityKind: "artist" } },
      { path: "albums", name: "albums", component: () => import("@/views/AlbumsView.vue") },
      { path: "albums/:id", name: "album", component: () => import("@/views/EntityDetailView.vue"), meta: { entityKind: "album" } },
      { path: "tracks", name: "tracks", component: () => import("@/views/TracksView.vue") },
      { path: "tracks/:id", name: "track", component: () => import("@/views/EntityDetailView.vue"), meta: { entityKind: "track" } },
      { path: "pulse", name: "pulse", component: () => import("@/views/PulseView.vue") },
      { path: "sessions", name: "sessions", component: () => import("@/views/SessionsView.vue") },
      { path: "wrapped", name: "wrapped", component: () => import("@/views/WrappedView.vue"), meta: { fixedRange: "This year" } },
    ],
  },
];

export const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.checkAuth();
  const result = resolveGuard({ authenticated: auth.authenticated, to: to.fullPath, isLoginRoute: to.path === "/login" });
  if ("allow" in result) return true;
  return { path: result.redirect, query: result.query };
});
