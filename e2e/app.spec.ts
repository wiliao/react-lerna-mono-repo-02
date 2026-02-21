// e2e/app.spec.ts
import { test, expect } from "@playwright/test";

test("homepage loads and shows expected content", async ({ page }) => {
  await page.goto("/");

  // ✅ Wait for page to be fully loaded
  await page.waitForLoadState("networkidle");

  // ✅ Target specific heading by text (strict-mode safe)
  await expect(
    page.getByRole("heading", { name: "Lerna Mono Demo (React 19)" }),
  ).toBeVisible();

  // ✅ Verify body is visible (basic sanity check)
  await expect(page.locator("body")).toBeVisible();
});

test("API health check works", async ({ request }) => {
  const response = await request.get("http://localhost:4000/health");
  expect(response.status()).toBe(200);

  const json = await response.json();
  expect(json).toMatchObject({
    status: "ok",
    service: expect.any(String),
  });
});
