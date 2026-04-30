import { test, expect } from "@playwright/test";

/**
 * Settings page: profile section, linked accounts, legal, delete account.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({
    timeout: 15_000,
  });
});

test("settings shows Profile section with user fields", async ({ page }) => {
  await expect(page.locator("text=/^Name$/i").first()).toBeVisible();
  await expect(page.locator("text=/^Email$/i").first()).toBeVisible();
  await expect(page.locator("text=/^Role$/i").first()).toBeVisible();
});

test("settings shows Shared With section for members", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Shared With" })
  ).toBeVisible({ timeout: 5_000 });
});

test("settings shows Legal section with Terms and Privacy links", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Legal" })).toBeVisible();
  await expect(page.locator('a[href="/terms"]').first()).toBeVisible();
  await expect(page.locator('a[href="/privacy"]').first()).toBeVisible();
});

test("Delete account dialog opens and closes via Cancel", async ({ page }) => {
  const deleteBtn = page.getByRole("button", { name: "Delete account", exact: true });
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();
  const dialog = page.locator('[role="alertdialog"]');
  await expect(dialog).toBeVisible({ timeout: 3_000 });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});
