import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("A11y & theme & responsive", () => {
  test("tab order login: username → password → toggle sandi → masuk", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /sandi/i })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /masuk/i })).toBeFocused();
  });

  test("dialog: muncul, Esc menutup", async ({ page }) => {
    await login(page);
    await page.goto("/regist");
    await page.getByRole("button", { name: "Registrasi Baru" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("toggle tema: light → dark → light", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Ganti tema" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Ganti tema" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("responsive: navbar mobile di viewport kecil, rail di viewport besar", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator(".vm3-navbar").getByText("Scan", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator(".vm3-rail").getByText("Dashboard", { exact: true })).toBeVisible();
  });
});
