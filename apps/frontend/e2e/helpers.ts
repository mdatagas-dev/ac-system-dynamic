import { expect, type Page } from "@playwright/test";

/** Login via UI form */
export async function login(page: Page, username = "e2e_test", password = "e2e_pass_2026") {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /masuk/i }).click();
  try {
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  } catch (err) {
    const alert = await page.locator("form [role=alert]").allInnerTexts().catch(() => []);
    console.log("[login-debug] URL:", page.url(), "| alerts:", JSON.stringify(alert));
    throw err;
  }
}

/** Login via API, kembalikan header Cookie session (untuk setup data) */
export async function apiLogin(request: import("@playwright/test").APIRequestContext) {
  const res = await request.post("http://localhost:3010/auth/login", {
    data: { username: "e2e_test", password: "e2e_pass_2026" },
  });
  const setCookie = res.headers()["set-cookie"] || "";
  const sid = /session_id=([^;]+)/.exec(setCookie)?.[1];
  if (!sid) throw new Error("apiLogin: tidak ada session_id di Set-Cookie");
  return `session_id=${sid}`;
}
