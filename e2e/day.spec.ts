import { expect, test, type Page } from "@playwright/test";
import { loginOk } from "./helpers";

// One complete working day per company, through the real UI:
// PO -> receive -> putaway -> sales order -> FEFO pick -> pack -> dispatch + challan
// -> transfer -> customer return -> cycle count with manager approval.
test.describe.configure({ mode: "serial" });

const COMPANIES = [
  { code: "BT", domain: "bondtherapy.test" },
  { code: "RF", domain: "richfill.test" },
];

/** Sign out and in as someone else (the day passes through several roles). */
async function become(page: Page, email: string) {
  if (!page.url().includes("/login")) {
    await page.getByTestId("user-menu").click();
    await page.getByTestId("sign-out").click();
    await expect(page).toHaveURL(/\/login/);
  }
  await loginOk(page, email);
}

async function toast(page: Page, text: RegExp | string) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

for (const c of COMPANIES) {
  test(`${c.code}: a day in the warehouse`, async ({ page }) => {
    test.setTimeout(240_000);
    const sku = `${c.code}-0001`;
    const manager = `warehousemanager@${c.domain}`;
    const keeper = `storekeeper@${c.domain}`;
    await page.goto("/login");
    await become(page, manager);

    // 1. Purchase order for 24 units.
    await page.goto("/purchase-orders/new");
    await page.getByLabel("Supplier").fill(`${c.code} factory`);
    await page.locator("#p-0").selectOption({ index: 1 });
    await page.locator('input[type="number"]').first().fill("24");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/purchase-orders\/c/);
    await expect(page.getByTestId("page-title")).toContainText("PO");

    // 2. Receive it: 22 good, 2 damaged, with batch and expiry.
    await page.getByRole("link", { name: "Receive goods" }).click();
    await expect(page.locator("#received-0")).toHaveValue("24");
    await page.locator("#received-0").fill("22");
    await page.locator("#damaged-0").fill("2");
    await page.locator("#b-0").fill(`E2E-${c.code}`);
    await page.locator("#x-0").fill("2027-12-31");
    await page.getByRole("button", { name: "Post receipt" }).click();
    await expect(page).toHaveURL(/\/inward\/putaway/);

    // 3. Putaway on the suggested tile (the product's default tile).
    const card = page.getByTestId(`putaway-${sku}`).first();
    const suggested = (await card.locator(".font-mono").first().textContent())!.trim();
    await card.getByRole("button", { name: suggested }).click();
    await card.getByRole("button", { name: "Confirm" }).click();
    await toast(page, new RegExp(`22 units put away on ${suggested}`));

    // 4. Billing enters a sales order for 5; the store keeper creates the FEFO pick list.
    await become(page, `billing@${c.domain}`);
    await page.goto("/sales-orders/new");
    await page.getByLabel("Customer").fill(`${c.code} Salon`);
    await page.locator("#p-0").selectOption({ index: 1 });
    await page.locator('input[type="number"]').first().fill("5");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/sales-orders\/c/);
    const soUrl = page.url();
    await become(page, keeper);
    await page.goto(soUrl);
    await page.getByRole("button", { name: "Create pick list (FEFO)" }).click();
    await toast(page, /Pick list PL-/);

    // 5. Pick: wrong tile is refused, right tile confirms.
    await page.getByRole("link", { name: /^PL-/ }).click();
    const line = page.getByTestId("pick-line-1");
    const tile = (await line.locator("p.font-semibold .font-mono").textContent())!.trim();
    await line.getByLabel("Scan or type the tile").fill(`${c.code}-Z-99-9`);
    await line.getByRole("button", { name: "Confirm" }).click();
    await expect(line.getByRole("alert").filter({ hasText: /Wrong tile/ })).toBeVisible();
    await line.getByLabel("Scan or type the tile").fill(tile);
    await line.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("All lines picked")).toBeVisible();

    // 6. Pack and dispatch; challan PDF opens.
    await page.getByRole("link", { name: /^SO-/ }).click();
    await page.getByRole("button", { name: "Packing check done" }).click();
    await toast(page, "Order packed");
    await page.getByLabel("Vehicle no.").fill("MH12AB1234");
    await page.getByLabel("LR no.").fill("LR-77");
    await page.getByRole("button", { name: "Confirm dispatch" }).click();
    await toast(page, /Dispatched: challan DC-/);
    await expect(page.getByText("Dispatched").first()).toBeVisible();
    const href = await page.getByRole("link", { name: "Challan (PDF)" }).first().getAttribute("href");
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");

    // 7. Ledger shows the outward movement from that tile.
    await page.goto(`/stock/ledger?tile=${tile}`);
    await expect(page.getByTestId("table-ledger").locator("table").getByText("OUTWARD").first()).toBeVisible();

    // 8. Transfer 2 units to another tile.
    await page.goto("/transfers");
    const lotValue = await page
      .locator("#lot option")
      .filter({ hasText: new RegExp(`^${tile} · ${sku}.*E2E-${c.code}`) })
      .first()
      .getAttribute("value");
    await page.locator("#lot").selectOption(lotValue!);
    await page.getByLabel("To tile").fill(`${c.code}-D-10-1`);
    await page.getByLabel("Qty").fill("2");
    await page.getByLabel("Reason").fill("Re-slot");
    await page.getByRole("button", { name: "Move stock" }).click();
    await toast(page, "Moved 2 units");

    // 9. Customer return, restocked after inspection.
    await page.goto("/returns");
    await page.getByLabel("Customer").fill(`${c.code} Salon`);
    await page.locator("#ret-product").selectOption({ index: 1 });
    await page.locator("#ret-batch").fill(`E2E-${c.code}`);
    await page.locator("#ret-qty").fill("1");
    await page.locator("#ret-reason").fill("Wrong item");
    await page.getByRole("button", { name: "Receive a return" }).click();
    await toast(page, /Return RT-/);
    const ret = page.getByTestId("returns-list").locator("li").first();
    await ret.getByRole("textbox", { name: "Restock to tile" }).fill(tile);
    await ret.getByRole("button", { name: "Inspect" }).click();
    await expect(page.getByTestId("returns-list").locator("li").first().getByText("Closed")).toBeVisible();

    // 10. Cycle count on the tile: store keeper counts one less, manager approves.
    await page.goto("/stock-audits");
    await page.getByLabel(/Tiles to count/).fill(tile);
    await page.getByRole("button", { name: "New count" }).click();
    await expect(page).toHaveURL(/\/stock-audits\/c/);
    const counted = page.getByRole("spinbutton", { name: /Counted/ });
    const n = await counted.count();
    for (let i = 0; i < n; i++) {
      const sys = await page.locator("tbody tr").nth(i).locator("td").nth(2).textContent();
      await counted.nth(i).fill(String(Number(sys!.replace(/\D/g, "")) - (i === 0 ? 1 : 0)));
    }
    await page
      .getByRole("textbox", { name: new RegExp(`Reason ${tile}`) })
      .first()
      .fill("One broken bottle");
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await toast(page, "Saved");
    await expect(page.getByRole("button", { name: "Approve and adjust stock" })).toHaveCount(0); // keeper cannot approve
    const countUrl = page.url();
    await become(page, manager);
    await page.goto(countUrl);
    await page.getByRole("button", { name: "Approve and adjust stock" }).click();
    await toast(page, /1 adjustment\(s\) posted/);
    await page.goto("/adjustments");
    await expect(
      page.getByTestId("table-adjustments").locator("table").getByText("One broken bottle").first(),
    ).toBeVisible();
  });
}

test.describe("role limits on the new screens", () => {
  test("STORE_KEEPER cannot approve write-offs or counts", async ({ page }) => {
    await loginOk(page, "storekeeper@bondtherapy.test");
    await page.goto("/damages");
    await page.locator("#wo-lot").selectOption({ index: 1 });
    await page.locator("#wo-qty").fill("1");
    await page.locator("#wo-reason").fill("Dropped");
    await page.getByRole("button", { name: "Report a write-off" }).click();
    await toast(page, /sent for approval/);
    await expect(page.getByTestId("writeoff-list").getByRole("button", { name: "Approve" })).toHaveCount(0);
    await page.goto("/stock-audits");
    await expect(page.getByRole("button", { name: "Approve and adjust stock" })).toHaveCount(0);
    await page.goto("/users");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("VIEWER cannot edit anything", async ({ page }) => {
    await loginOk(page, "viewer@richfill.test");
    await page.goto("/sales-orders");
    await expect(page.getByRole("link", { name: "New sales order" })).toHaveCount(0);
    for (const path of [
      "/sales-orders/new",
      "/purchase-orders/new",
      "/products/new",
      "/locations/new",
      "/inward/new",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/forbidden$/);
    }
    await page.goto("/transfers");
    await expect(page.getByRole("button", { name: "Move stock" })).toHaveCount(0);
    await page.goto("/inward/putaway");
    await expect(page.getByRole("button", { name: "Confirm" })).toHaveCount(0);
  });
});
