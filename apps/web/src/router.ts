import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: () => import("./views/HomeView.vue") },
    { path: "/verify/:code", name: "verify", component: () => import("./views/VerifyView.vue") },
    { path: "/admin", name: "admin", component: () => import("./views/AdminView.vue") },
  ],
});
