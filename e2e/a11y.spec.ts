import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginOk } from "./helpers";

// WCAG 2.1 AA checks with axe on every main screen, light and dark, desktop and phone.
const SCREENS = [
  "/dashboard",
  "/products",
  "/locations",
  "/locations/map",
  "/stock",
  "/scan",
  "/search?q=bt",
  "/settings/password",
  "/sales-orders",
  "/sales-orders/new",
  "/inward/new",
  "/inward/putaway",
  "/transfers",
  "/returns",
  "/damages",
  "/stock-audits",
  "/stock/ledger",
  "/locations/new",
  "/products/import",
  "/reports",
  "/owner",
  "/labels",
  "/settings/company",
  "/audit-log",
];

async function check(page: import("@playwright/test").Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map(
      (v) =>
        `${label}: ${v.id} (${v.impact}) ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [1280, 360]) {
    test(`axe: no serious or critical violations (${theme}, ${width}px)`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto("/login");
      const found = await check(page, `/login ${theme} ${width}`);
      await loginOk(page, "owner@btwarehouse.test");
      for (const path of SCREENS) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        found.push(...(await check(page, `${path} ${theme} ${width}`)));
      }
      expect(found).toEqual([]);
    });
  }
}
