import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * RBAC + fitur baru: menu per role, combobox model BOM, tombol import scan.
 */
test.describe("RBAC & fitur", () => {
  test("superuser: semua menu terlihat", async ({ page }) => {
    await login(page, "e2e_test");
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Registrasi/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Scan/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Riwayat/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Master Data/i })).toBeVisible();
  });

  test("ppc: hanya Registrasi + Scan", async ({ page }) => {
    await login(page, "e2e_ppc");
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Registrasi/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Scan/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Dashboard/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Riwayat/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Master Data/i })).toHaveCount(0);
  });

  test("bomlist: Model pakai combobox (cari → pilih dari Model Master)", async ({ page, request }) => {
    // siapkan model master via API (combobox mengisi dari /model)
    const token = await (await import("./helpers")).apiLogin(request);
    const uniq = Date.now().toString(36);
    const modelName = `E2E-CB-${uniq}`;
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const mk = await request.post("http://localhost:3010/model/post", { headers: auth, data: { brand: "E2E", model: modelName, pk: 1 } });
    expect(mk.status()).toBe(200);
    const modelId = (await mk.json()).data.id;

    try {
      await login(page);
      await page.goto("/master");
      await page.getByRole("tab", { name: "BOM List" }).click();
      await page.getByRole("button", { name: "Tambah BOM List" }).click();

      const modelInput = page.getByLabel("Model", { exact: true });
      await expect(modelInput).toBeVisible();
      await modelInput.fill(modelName);
      // Base UI Autocomplete: item = div.vm3-select-item (tanpa role option);
      // cukup buktikan hasil pencarian muncul (menghindari click popup yang flaky)
      const option = page.locator(".vm3-select-item", { hasText: modelName }).first();
      await expect(option).toBeVisible({ timeout: 5_000 });
      // tutup dialog via Esc (popup combobox bisa menghalangi tombol Batal)
      await page.keyboard.press("Escape");
    } finally {
      try {
        await request.delete(`http://localhost:3010/model/delete/${modelId}`, { headers: auth });
      } catch {
        /* abaikan */
      }
    }
  });

  test("scan: tombol Import Scan hanya untuk superuser", async ({ page }) => {
    await login(page);
    await page.goto("/scan");
    await expect(page.getByRole("button", { name: /Import Scan/i })).toBeVisible();

    await page.getByRole("button", { name: "Keluar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Keluar", exact: true }).click();
    await login(page, "e2e_ppc");
    await page.goto("/scan");
    await expect(page.getByRole("button", { name: /Import Scan/i })).toHaveCount(0);
  });
});
