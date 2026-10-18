import { expect, test } from "@playwright/test";
import { loginOk, proxy } from "./helpers";

// The database disappears (connections dropped, new ones refused) and comes back,
// like a Railway Postgres restart. The app must never crash or show a stack trace,
// and must recover by itself without restarting the server.
test.afterEach(async () => {
  await proxy("up");
});

test("database outage: friendly screens, then automatic recovery", async ({ page, request }) => {
  await loginOk(page, "admin@bondtherapy.test");
  await expect(page.getByTestId("dashboard-title")).toBeVisible();

  await proxy("down");

  // Health check reports it.
  const down = await request.get("/api/health");
  expect(down.status()).toBe(503);
  expect(await down.json()).toMatchObject({ db: "down" });

  // API errors are friendly JSON with a reference, never internals.
  const api = await request.get("/api/products");
  expect([401, 500, 503]).toContain(api.status());
  expect(await api.text()).not.toMatch(/prisma|stack|at .*\.js|ECONNREFUSED/i);

  // Pages show the friendly error screen and the reconnecting banner.
  await page.goto("/products");
  await expect(page.getByTestId("error-view")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("error-view")).toContainText("Reconnecting to the database");
  await expect(page.getByTestId("connection-banner")).toBeVisible();
  const html = await page.content();
  expect(html).not.toMatch(/PrismaClient|Error: |at async|node_modules/);

  // Database comes back: the page recovers on its own (no reload, no server restart).
  await proxy("up");
  await expect(page.getByTestId("page-title")).toHaveText("Products", { timeout: 30_000 });
  await expect(page.getByTestId("connection-banner")).toBeHidden({ timeout: 15_000 });
  expect((await request.get("/api/health")).status()).toBe(200);
});

test("brief blip during a read is absorbed by retry", async ({ page }) => {
  await loginOk(page, "admin@bondtherapy.test");
  await proxy("down");
  setTimeout(() => void proxy("up"), 500); // back before the retries run out (200+400+800ms)
  const res = await page.request.get("/api/products");
  expect(res.status()).toBe(200);
  expect((await res.json()).total).toBe(35);
});
