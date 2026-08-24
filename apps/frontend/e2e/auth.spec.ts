import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Auth", () => {
  test("login page menampilkan form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /masuk/i })).toBeVisible();
  });

  test("proteksi route: tanpa login redirect ke /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("kredensial salah → pesan error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("e2e_test");
    await page.getByLabel("Password").fill("salah_password");
    await page.getByRole("button", { name: /masuk/i }).click();
    await expect(page.locator("form [role=alert]")).toContainText(
      /Username Not Found|Wrong Password|Error/i,
      { timeout: 10_000 },
    );
  });

  test("login benar → dashboard, logout → kembali login", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: /Selamat pagi/i })).toBeVisible();
    await page.getByRole("button", { name: "Keluar" }).click();
    // Konfirmasi logout via Dialog (smooth popup)
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keluar", exact: true }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
