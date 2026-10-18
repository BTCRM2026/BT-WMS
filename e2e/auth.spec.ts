import { expect, test } from "@playwright/test";
import { login, loginOk } from "./helpers";

test.describe("login lands on the right company", () => {
  for (const [email, company] of [
    ["admin@bondtherapy.test", "Bond Therapy"],
    ["admin@richfill.test", "Rich Fill"],
    ["storekeeper@richfill.test", "Rich Fill"],
  ] as const) {
    test(`${email} -> ${company} dashboard`, async ({ page }) => {
      await loginOk(page, email);
      await expect(page.getByTestId("dashboard-title")).toHaveText(`${company} dashboard`);
      await expect(page.getByTestId("company-name")).toHaveText(company);
      await expect(page.getByTestId("company-switcher")).toHaveCount(0); // only the owner switches
    });
  }

  test("owner can switch between companies", async ({ page }) => {
    await loginOk(page, "owner@btwarehouse.test");
    await expect(page.getByTestId("dashboard-title")).toHaveText("Bond Therapy dashboard");
    await page.getByTestId("company-switcher").click();
    await page.getByTestId("switch-rich-fill").click();
    await expect(page.getByTestId("dashboard-title")).toHaveText("Rich Fill dashboard");
    await expect(page.getByTestId("company-name")).toHaveText("Rich Fill");
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
      await loginOk(page, email);
      await page.goto(path);
      await expect(page).toHaveURL(/\/forbidden$/);
      await expect(page.getByTestId("forbidden")).toBeVisible();
    });
  }

  test("API answers 403, not data", async ({ page }) => {
    await loginOk(page, "viewer@bondtherapy.test");
    expect((await page.request.get("/api/users")).status()).toBe(403);
  });
});

test("sign out ends the session", async ({ page }) => {
  await loginOk(page, "admin@bondtherapy.test");
  await page.getByTestId("user-menu").click();
  await page.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("dark mode choice is remembered", async ({ page }) => {
  await loginOk(page, "admin@bondtherapy.test");
  await page.getByTestId("theme-toggle").click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("health endpoint reports the database", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok", db: "up" });
});
