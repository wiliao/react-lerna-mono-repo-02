// playwright.config.ts (at root)
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e", // ✅ Tests at root/e2e/
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: "http://localhost:3000", // Your web app URL
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Add more browsers as needed
  ],

  // ✅ Auto-start your apps before tests
  webServer: [
    {
      command: "npm run start:app", // Backend
      url: "http://localhost:4000/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run start:web", // Frontend
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
