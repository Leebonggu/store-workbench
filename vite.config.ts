import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: { input: { app: "index.html", guide: "guide.html" } },
  },
  server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:3583" } },
});
