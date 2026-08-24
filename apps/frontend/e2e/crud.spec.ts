import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * CRUD master data (tab Model): tambah → edit → hapus via UI.
 */
test("master model: tambah, edit, hapus", async ({ page }) => {
  const uniq = Date.now().toString(36);
  const modelName = `E2E-MOD-${uniq}`;

  await login(page);
  await page.goto("/master");

  // Tab Model (default)
  await page.getByRole("button", { name: "Tambah Model" }).click();

  // Dialog tambah
  await page.getByLabel("Brand").fill("E2E Brand");
  await page.getByLabel("Model", { exact: true }).fill(modelName);
  await page.getByLabel("PK").fill("10");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();

  // Muncul di tabel
  await expect(page.getByRole("cell", { name: modelName })).toBeVisible({ timeout: 15_000 });

  // Edit
  await page.getByRole("row", { name: new RegExp(modelName) }).getByRole("button", { name: "Edit" }).click();
  const brandField = page.getByLabel("Brand");
  await brandField.fill("E2E Brand Edit");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("cell", { name: "E2E Brand Edit" })).toBeVisible({ timeout: 15_000 });

  // Hapus
  await page.getByRole("row", { name: new RegExp(modelName) }).getByRole("button", { name: "Hapus" }).click();
  await page.getByRole("button", { name: "Hapus", exact: true }).click();
  await expect(page.getByRole("cell", { name: modelName })).toHaveCount(0, { timeout: 15_000 });
});
