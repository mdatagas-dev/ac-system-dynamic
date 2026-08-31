import { test, expect } from "@playwright/test";
import { login, apiLogin } from "./helpers";

/**
 * CRUD master data (tab Model): tambah → edit → hapus via UI.
 * Hierarki: model wajib kategori — siapkan via API dulu.
 */
test("master model: tambah, edit, hapus", async ({ page, request }) => {
  const uniq = Date.now().toString(36);
  const modelName = `E2E-MOD-${uniq}`;

  // kategori via API
  const token = await apiLogin(request);
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const cat = await request.post("http://localhost:3010/product-categories/post", {
    headers: auth,
    data: { slug: `e2e-cat-${uniq}`, name: `E2E Cat ${uniq}` },
  });
  expect(cat.status()).toBe(201);
  const catId = (await cat.json()).data.id;

  try {
    await login(page);
    await page.goto("/master");

    // Tab Model (default)
    await page.getByRole("button", { name: "Tambah Model" }).click();

    // Dialog tambah
    await page.getByLabel("Brand").fill("E2E Brand");
    await page.getByLabel("Model", { exact: true }).fill(modelName);
    await page.getByLabel("Model", { exact: true }).fill(modelName);
    // vm3 Select (shadcn/radix): trigger role=combobox, item = [data-slot="select-item"]
    await page.getByRole("combobox").click();
    await page.locator('[data-slot="select-item"]', { hasText: `E2E Cat ${uniq}` }).first().click();
    await page.getByLabel("PK").fill("10");
    await page.getByRole("button", { name: "Simpan", exact: true }).click();

  // Muncul di tabel
  await expect(page.getByRole("cell", { name: modelName })).toBeVisible({ timeout: 15_000 });

    // Edit
    await page.getByRole("row", { name: new RegExp(modelName) }).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Brand").fill("E2E Brand Edit");
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByRole("cell", { name: "E2E Brand Edit" })).toBeVisible({ timeout: 15_000 });

    // Hapus
    await page.getByRole("row", { name: new RegExp(modelName) }).getByRole("button", { name: "Hapus" }).click();
    await page.getByRole("button", { name: "Hapus", exact: true }).click();
    await expect(page.getByRole("cell", { name: modelName })).toHaveCount(0, { timeout: 15_000 });
  } finally {
    try {
      await request.delete(`http://localhost:3010/product-categories/delete/${catId}`, { headers: auth });
    } catch {
      /* abaikan */
    }
  }
});
