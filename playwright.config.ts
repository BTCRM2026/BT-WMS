import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const PROXY_PORT = 54400;

// The app talks to this run's fresh database (e2e/prepare-db.mjs) THROUGH a
// switchable proxy, so resilience tests can take the database down and back up.
const DATABASE_URL = (() => {
  try {
    const u = new URL(readFileSync(".e2e-db-url", "utf8").trim());
    u.hostname = "127.0.0.1";
    u.port = String(PROXY_PORT);
    return u.toString();
  } catch {
    return "";
  }
})();

const desktop = (width: number) => ({ ...devices["Desktop Chrome"], viewport: { width, height: 900 } });

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    // Functional, auth, accessibility and resilience tests: desktop Chrome.
    { name: "chromium", use: desktop(1280), testIgnore: /ui\.spec/ },
    // Layout checks of every main screen at the four target widths.
    { name: "w360", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } }, testMatch: /ui\.spec/ },
    {
      name: "w768",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true },
      testMatch: /ui\.spec/,
    },
    { name: "w1280", use: desktop(1280), testMatch: /ui\.spec/ },
    { name: "w1920", use: desktop(1920), testMatch: /ui\.spec/ },
    // Cross-browser smoke of the same screens. Firefox runs in CI (Linux); on Windows,
    // Smart App Control can block Playwright's unsigned Firefox build, so Edge runs instead.
    ...(process.platform !== "win32" || process.env.CI
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 900 } },
            testMatch: /ui\.spec/,
          },
        ]
      : [
          {
            name: "edge",
            use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1280, height: 900 } },
            testMatch: /ui\.spec/,
          },
        ]),
    { name: "webkit-iphone", use: { ...devices["iPhone 13"] }, testMatch: /ui\.spec/ },
  ],
  webServer: [
    {
      command: "node e2e/db-proxy.mjs",
      url: "http://127.0.0.1:54401/status",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // The real production entrypoint: migrate deploy + next start (build first).
      command: "node scripts/start.mjs",
      url: `http://127.0.0.1:${PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { PORT: String(PORT), DATABASE_URL },
    },
  ],
});
