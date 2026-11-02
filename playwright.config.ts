import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui",
  use: { baseURL: "http://127.0.0.1:4178", headless: true, channel: "chrome" },
  webServer: {
    command: "npm run dev -- --port 4178 --strictPort",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
  },
  reporter: "list",
});
