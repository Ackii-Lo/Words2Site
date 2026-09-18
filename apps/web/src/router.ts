import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      // 主入口 = 现场大屏（原 /screen）；/start 是制作流程页
      path: "/",
      name: "screen",
      component: () => import("./views/ScreenView.vue"),
    },
    {
      path: "/start",
      name: "home",
      component: () => import("./views/HomeView.vue"),
    },
    // 老链接 /screen（含已印出的二维码）统一跳回大屏
    { path: "/screen", redirect: "/" },
    {
      path: "/verify/:code",
      name: "verify",
      component: () => import("./views/VerifyView.vue"),
    },
    {
      path: "/admin",
      name: "admin",
      component: () => import("./views/AdminView.vue"),
    },
  ],
});
