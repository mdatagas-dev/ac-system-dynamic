import { defineConfig } from "@playwright/test";
import { E2E_DATABASE_URL } from "./playwright/db";

/** E2E only runs against an explicitly configured database whose URL contains `test`. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  globalSetup: "./playwright/global-setup.ts",
  globalTeardown: "./playwright/global-teardown.ts",
  webServer: [
    {
      command: "node ../backend/src/index.js",
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
      port: 3010,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      // NEXT_PUBLIC_MOCK=0: E2E harus hit backend real (mock tak validasi password & tak sinkron dgn data API)
      command: "NEXT_PUBLIC_MOCK=0 node node_modules/next/dist/bin/next dev -p 3000",
      port: 3000,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
