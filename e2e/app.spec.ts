// e2e/app.spec.ts - UPDATED
import { test, expect } from "@playwright/test";

test("homepage loads and shows login page", async ({ page }) => {
  await page.goto("http://localhost:3000");

  // ✅ App now requires login — heading is behind auth gate
  // First thing we should see is the Sign In form
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible({
    timeout: 10000,
  });

  await expect(page.locator("body")).toBeVisible();
});

test("login flow shows main app", async ({ page }) => {
  await page.goto("http://localhost:3000");

  // ✅ Wait for login page to load
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible({
    timeout: 10000,
  });

  // ✅ Fill in credentials (seeded by npm run seed)
  await page.getByPlaceholder("Username").fill("admin");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();

  // ✅ After login, main app heading should be visible
  await expect(
    page.getByRole("heading", { name: "Lerna Mono Demo (React 19)" }),
  ).toBeVisible({ timeout: 10000 });

  // ✅ Users list should load
  await expect(page.getByText("User: Alice (ID: 1)")).toBeVisible({
    timeout: 10000,
  });

  // ✅ Logged-in username should appear in header
  await expect(page.getByText("👤 admin")).toBeVisible();
});

test("logout returns to login page", async ({ page }) => {
  await page.goto("http://localhost:3000");

  // Login first
  await page.getByPlaceholder("Username").fill("admin");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for main app
  await expect(
    page.getByRole("heading", { name: "Lerna Mono Demo (React 19)" }),
  ).toBeVisible({ timeout: 10000 });

  // ✅ Click logout
  await page.getByRole("button", { name: "Logout" }).click();

  // ✅ Should return to login page
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible({
    timeout: 10000,
  });
});

test("health endpoint is reachable", async ({ page }) => {
  const response = await page.goto("http://localhost:4000/health");

  expect(response?.status()).toBe(200);

  const body = await page.evaluate(() => document.body.innerText);
  const json = JSON.parse(body);

  expect(json.status).toBe("ok");
});
