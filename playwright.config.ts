import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// Written by e2e/prepare-db.mjs (`npm run test:e2e` runs it first).
const DATABASE_URL = (() => {
  try {
    return readFileSync(".e2e-db-url", "utf8").trim();
  } catch {
    return "";
  }
})();

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The real production entrypoint: migrate deploy + next start (build first).
    command: "node scripts/start.mjs",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PORT: String(PORT), DATABASE_URL },
  },
});
