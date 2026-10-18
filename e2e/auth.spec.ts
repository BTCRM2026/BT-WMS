import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "ChangeMe!2026";

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("login lands on the right company", () => {
  for (const [email, company] of [
    ["admin@bondtherapy.test", "Bond Therapy"],
    ["admin@richfill.test", "Rich Fill"],
    ["storekeeper@richfill.test", "Rich Fill"],
  ] as const) {
    test(`${email} -> ${company} dashboard`, async ({ page }) => {
      await login(page, email);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByTestId("dashboard-title")).toHaveText(`${company} dashboard`);
      await expect(page.getByTestId("company-name")).toHaveText(company);
      await expect(page.getByTestId("company-switcher")).toHaveCount(0); // only the owner switches
    });
  }

  test("owner can switch between companies", async ({ page }) => {
    await login(page, "owner@btwarehouse.test");
    await expect(page.getByTestId("dashboard-title")).toHaveText("Bond Therapy dashboard");
    await page.getByTestId("company-switcher").selectOption({ label: "Rich Fill" });
    await expect(page.getByTestId("dashboard-title")).toHaveText("Rich Fill dashboard");
  });
});

test("wrong password shows an error and stays on login", async ({ page }) => {
  await login(page, "viewer@bondtherapy.test", "WrongPassword1");
  await expect(page.getByRole("alert").filter({ hasText: /\w/ })).toHaveText("Email or password is incorrect.");
  await expect(page).toHaveURL(/\/login/);
});

test("logged-out users are sent to login", async ({ page }) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login\?next=%2Fusers/);
});

test.describe("direct URL access to another role's page is blocked", () => {
  for (const [email, path] of [
    ["storekeeper@bondtherapy.test", "/users"],
    ["viewer@bondtherapy.test", "/audit-log"],
    ["billing@bondtherapy.test", "/locations"],
  ] as const) {
    test(`${email} opening ${path}`, async ({ page }) => {
      await login(page, email);
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto(path);
      await expect(page).toHaveURL(/\/forbidden$/);
      await expect(page.getByTestId("forbidden")).toBeVisible();
    });
  }

  test("API answers 403, not data", async ({ page }) => {
    await login(page, "viewer@bondtherapy.test");
    await expect(page).toHaveURL(/\/dashboard$/);
    const res = await page.request.get("/api/users");
    expect(res.status()).toBe(403);
  });
});

test("sign out ends the session", async ({ page }) => {
  await login(page, "admin@bondtherapy.test");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("health endpoint reports the database", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok", db: "up" });
});
