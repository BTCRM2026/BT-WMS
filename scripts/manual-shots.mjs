// Screenshots for docs/USER-MANUAL.md, one set per role. Server must be running and seeded.
// Usage: node scripts/manual-shots.mjs [baseUrl]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:3200";
const pw = process.env.SEED_PASSWORD ?? "ChangeMe!2026";
const dir = "docs/manual";
mkdirSync(dir, { recursive: true });

const ROLES = [
  {
    role: "owner",
    email: "owner@btwarehouse.test",
    screens: ["/dashboard", "/owner", "/reports?report=valuation", "/settings/company"],
  },
  { role: "admin", email: "admin@bondtherapy.test", screens: ["/users", "/products", "/locations/new", "/audit-log"] },
  {
    role: "manager",
    email: "warehousemanager@bondtherapy.test",
    screens: ["/purchase-orders", "/inward", "/damages", "/stock-audits"],
  },
  {
    role: "storekeeper",
    email: "storekeeper@bondtherapy.test",
    phone: true,
    screens: ["/scan", "/inward/putaway", "/picking", "/locations/map"],
  },
  { role: "billing", email: "billing@richfill.test", screens: ["/sales-orders", "/sales-orders/new", "/dispatch"] },
  { role: "viewer", email: "viewer@richfill.test", screens: ["/dashboard", "/stock", "/stock/ledger"] },
];

const browser = await chromium.launch();
for (const r of ROLES) {
  const page = await browser.newPage({
    viewport: r.phone ? { width: 390, height: 844 } : { width: 1366, height: 860 },
  });
  await page.goto(`${base}/login`);
  await page.getByLabel("Email", { exact: true }).fill(r.email);
  await page.getByLabel("Password", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard/);
  for (const path of r.screens) {
    await page.goto(base + path);
    await page.waitForLoadState("networkidle");
    const name = `${r.role}-${path.slice(1).replace(/[/?=&]/g, "-")}.png`;
    await page.screenshot({ path: `${dir}/${name}` });
  }
  await page.close();
}
await browser.close();
console.log(`saved to ${dir}`);
