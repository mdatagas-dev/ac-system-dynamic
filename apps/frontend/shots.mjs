/**
 * Screenshot dashboard: desktop (rail ciut & lebar) + mobile.
 * Jalankan: node shots.mjs (butuh backend 3010 + DB; frontend dev auto-start).
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const BASE = "http://localhost:3000";
const OUT = "/tmp/opencode/ui-shots";

// pastikan dev server jalan
const dev = spawn("pnpm", ["dev"], { cwd: process.cwd(), stdio: "ignore", detached: true });
await new Promise((r) => setTimeout(r, 6000));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Username").fill("e2e_test");
  await page.getByLabel("Password").fill("e2e_pass_2026");
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(`${BASE}/`);
  await page.getByRole("heading", { name: "Dashboard UPH" }).waitFor();
  await page.waitForTimeout(1500); // tunggu entrance + count-up selesai

  await page.screenshot({ path: `${OUT}/dash-desktop-collapsed.png` });

  // lebarkan rail
  await page.getByRole("button", { name: "Lebarkan navigasi" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/dash-desktop-expanded.png` });

  // hover bar → tooltip (bar pertama model pertama)
  const bar = page.locator('[role="img"] [aria-hidden] > div').first();
  await bar.hover({ force: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/dash-tooltip.png` });

  // drawer mobile
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto(`${BASE}/login`);
  await mob.getByLabel("Username").fill("e2e_test");
  await mob.getByLabel("Password").fill("e2e_pass_2026");
  await mob.getByRole("button", { name: "Masuk" }).click();
  await mob.waitForURL(`${BASE}/`);
  await mob.waitForTimeout(1500);
  await mob.screenshot({ path: `${OUT}/dash-mobile.png` });
} finally {
  await browser.close();
  try {
    process.kill(-dev.pid);
  } catch {}
}
console.log("done");
