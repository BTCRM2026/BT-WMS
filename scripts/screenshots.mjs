// Captures the main screens at 360/768/1280/1920px into docs/screenshots/<label>/.
// Usage: node scripts/screenshots.mjs <label> [baseUrl]   (server must be running and seeded)
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const label = process.argv[2] ?? "current";
const base = process.argv[3] ?? "http://127.0.0.1:3200";
const WIDTHS = [360, 768, 1280, 1920];
const SCREENS = ["/dashboard", "/products", "/locations", "/stock", "/locations/map", "/scan"];
const dir = `docs/screenshots/${label}`;
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: width < 768 ? 780 : 900 } });
  await page.goto(`${base}/login`);
  await page.screenshot({ path: `${dir}/login-${width}.png`, fullPage: true });
  await page.getByLabel("Email", { exact: true }).fill("owner@btwarehouse.test");
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_PASSWORD ?? "ChangeMe!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard/);
  for (const path of SCREENS) {
    await page.goto(base + path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${dir}/${path.slice(1).replace(/\//g, "-")}-${width}.png`, fullPage: true });
  }
  await page.close();
}
await browser.close();
console.log(`saved to ${dir}`);
