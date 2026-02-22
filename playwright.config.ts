// playwright.config.ts (at root)
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  // ✅ Run global setup before any tests — seeds the database
  // so E2E tests always run against a known dataset
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "npm run start:app", // Backend API on :4000
      url: "http://localhost:4000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000, // ✅ Wait up to 60s for server to be ready
      stdout: "pipe", // ✅ Show server logs in Playwright output
      stderr: "pipe",
    },
    {
      command: "npm run start:web", // Frontend on :3000
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000, // ✅ Webpack can be slow on first build
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
