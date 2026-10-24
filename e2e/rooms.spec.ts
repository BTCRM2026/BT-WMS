import { expect, test } from "@playwright/test";
import { loginOk } from "./helpers";

test("rooms: create a room, add a row, open a tile, leave the room", async ({ page }) => {
  await loginOk(page, "warehousemanager@bondtherapy.test");
  await page.goto("/locations/rooms");
  await expect(page.getByTestId("room-BT")).toBeVisible();

  await page.getByTestId("new-room").click();
  await page.getByLabel("Room code").fill("BT5");
  await page.getByLabel("Name", { exact: true }).fill("Room 5");
  await page.getByLabel("Where is it? (optional)").fill("1st floor");
  await page.getByRole("dialog").getByRole("button", { name: "New room" }).click();
  await expect(page).toHaveURL(/\/locations\/rooms\/BT5$/);
  await expect(page.getByText("No tiles in this room yet")).toBeVisible();

  await page.getByTestId("add-row").click();
  await expect(page.getByLabel("Row letter")).toHaveValue("A");
  await page.getByLabel("Tiles in this row").fill("4");
  await page.getByLabel("Boxes per tile (optional)").fill("12");
  await expect(page.getByText("Creates 4 tiles: BT5-A-01-1 … BT5-A-04-1")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Add row" }).click();
  await expect(page.getByTestId("row-A").getByRole("button")).toHaveCount(4);

  await page.getByTestId("tile-BT5-A-03-1").click();
  await expect(page.getByRole("dialog", { name: "Stock on BT5-A-03-1" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("leave-room").click();
  await expect(page).toHaveURL(/\/locations\/rooms$/);
  await expect(page.getByTestId("room-BT5")).toContainText("4 tiles");
});

test("rooms: a viewer sees rooms but cannot change them", async ({ page }) => {
  await loginOk(page, "viewer@bondtherapy.test");
  await page.goto("/locations/rooms/BT");
  await expect(page.getByTestId("row-A")).toBeVisible();
  await expect(page.getByTestId("add-row")).toHaveCount(0);
  await expect(page.getByTestId("edit-room")).toHaveCount(0);
});
