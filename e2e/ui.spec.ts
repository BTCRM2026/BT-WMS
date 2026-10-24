import { expect, test } from "@playwright/test";
import { login, loginOk } from "./helpers";

// Runs once per width/browser project (360, 768, 1280, 1920, Firefox, iPhone Safari).
const SCREENS = [
  { path: "/dashboard", title: "Bond Therapy dashboard" },
  { path: "/products", title: "Products" },
  { path: "/locations", title: "Locations / Tiles" },
  { path: "/locations/map", title: "Warehouse floor map" },
  { path: "/locations/rooms", title: "Rooms" },
  { path: "/stock", title: "Stock" },
  { path: "/scan", title: "Scan" },
  { path: "/search?q=shampoo", title: "Search" },
  { path: "/settings/password", title: "Change password" },
  { path: "/sales-orders", title: "Sales orders" },
  { path: "/purchase-orders", title: "Purchase orders" },
  { path: "/inward", title: "Inward receipts" },
  { path: "/inward/putaway", title: "Putaway" },
  { path: "/picking", title: "Pick lists" },
  { path: "/dispatch", title: "Dispatch" },
  { path: "/transfers", title: "Internal transfer" },
  { path: "/returns", title: "Returns" },
  { path: "/damages", title: "Damage & expiry write-offs" },
  { path: "/stock-audits", title: "Stock audits (cycle counts)" },
  { path: "/adjustments", title: "Adjustments" },
  { path: "/stock/ledger", title: "Movement ledger" },
  { path: "/users", title: "Users" },
  { path: "/products/import", title: "Import products" },
  { path: "/locations/new", title: "New tile" },
  { path: "/reports", title: "Reports" },
  { path: "/owner", title: "Owner view" },
  { path: "/labels", title: "Labels" },
  { path: "/settings/company", title: "Company settings" },
  { path: "/audit-log", title: "Audit log" },
];

async function noHorizontalScroll(page: import("@playwright/test").Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll, "page must not scroll sideways").toBeLessThanOrEqual(width);
}

test("login screen", async ({ page }, info) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await noHorizontalScroll(page);
  await page.screenshot({ path: info.outputPath(`login.png`), fullPage: true });
  await login(page, "viewer@bondtherapy.test", "nope");
  await expect(page.getByRole("alert").filter({ hasText: /\w/ })).toBeVisible();
});

test("main screens render without sideways scroll", async ({ page }, info) => {
  test.setTimeout(300_000);
  await loginOk(page, "owner@btwarehouse.test");
  const width = page.viewportSize()!.width;
  for (const s of SCREENS) {
    await page.goto(s.path);
    await expect(page.getByTestId("page-title"), s.path).toHaveText(s.title);
    await page.waitForLoadState("networkidle");
    await noHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath(`${s.path.replace(/[/?=]/g, "_")}.png`), fullPage: true });
  }

  // Navigation pattern per width: bottom nav on phones, sidebar from tablet up.
  await page.goto("/dashboard");
  const bottomNav = page.locator("nav.fixed.bottom-0");
  if (width < 768) {
    await expect(bottomNav).toBeVisible();
    await expect(page.locator("aside")).toBeHidden();
  } else {
    await expect(bottomNav).toBeHidden();
    await expect(page.locator("aside")).toBeVisible();
  }
});

test("phones get big touch targets", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 768, "phone-only check");
  await loginOk(page, "storekeeper@bondtherapy.test");
  for (const path of ["/dashboard", "/scan"]) {
    await page.goto(path);
    const small = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "main button:not([disabled]), main a, nav.fixed a, nav.fixed button, header button, header a",
        ),
      ]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({
          el: el.getAttribute("aria-label") ?? el.textContent?.trim(),
          ...el.getBoundingClientRect().toJSON(),
        }))
        .filter((r) => r.height < 44 && r.width < 44),
    );
    expect(small, `targets under 44px on ${path}`).toEqual([]);
  }
});

test("tables: sort, filter, export", async ({ page }) => {
  await loginOk(page, "admin@bondtherapy.test");
  await page.goto("/products");
  const table = page.getByTestId("table-products");
  await table.getByRole("searchbox").fill("BT-0001");
  await expect(table.getByText("1–1 of 1")).toBeVisible();
  await table.getByRole("searchbox").fill("");
  await table.getByRole("combobox").selectOption("low");
  await expect(table.getByText(/^1–\d+ of \d+$/)).not.toHaveText("1–25 of 35"); // narrowed to low-stock rows
  const download = page.waitForEvent("download");
  await table.getByRole("button", { name: /Export CSV/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^products-.*\.csv$/);
});

test("floor map: clicking a tile shows its stock", async ({ page }) => {
  await loginOk(page, "admin@bondtherapy.test");
  await page.goto("/locations/map");
  await page.getByTestId("tile-BT-A-01-1").click();
  await expect(page.getByRole("dialog", { name: "Stock on BT-A-01-1" })).toBeVisible();
  await expect(page.getByTestId("tile-lines").locator("li")).not.toHaveCount(0);
});

test("scan: manual / USB-scanner entry finds a tile", async ({ page }) => {
  await loginOk(page, "storekeeper@bondtherapy.test");
  await page.goto("/scan");
  await page.getByLabel("Code").fill("bt-a-01-1");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("scan-result")).toContainText("BT-A-01-1");
});
