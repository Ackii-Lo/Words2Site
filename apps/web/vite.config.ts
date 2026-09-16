import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Vite 默认只读 apps/web/.env；指到仓库根，让 VITE_*（如 VITE_API_BASE）与后端共用一份 .env
  envDir: path.resolve(import.meta.dirname, "../.."),
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/preview": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
