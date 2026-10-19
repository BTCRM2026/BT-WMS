import { expect, type Page } from "@playwright/test";

export const PASSWORD = "ChangeMe!2026";

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function loginOk(page: Page, email: string) {
  await login(page, email);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
}

export const proxy = (state: "up" | "down") => fetch(`http://127.0.0.1:54401/${state}`);
