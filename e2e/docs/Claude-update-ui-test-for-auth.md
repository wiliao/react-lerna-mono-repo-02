# Update UI Test

Good progress — 13 out of 15 passing. The 2 failing auth tests are returning 500 instead of 401/403 because `jest.unmock` doesn't work reliably after `jest.mock` has already been hoisted. The `UserModel` mock is also missing from the `Authentication` block, so `find()` calls throw errors.

The simplest fix is to remove the `Authentication` describe block from this file entirely and move it to a separate test file that never mocks `requireAuth`:

**Remove the `Authentication` block from `app.test.ts`**, then create `packages/app/src/auth.test.ts`:

```typescript
import request from "supertest";
import { createApp } from "./app";
import { Server } from "http";

// ─────────────────────────────────────────────────────────────
// 🧪 Mock UserModel only — requireAuth is NOT mocked here
// ─────────────────────────────────────────────────────────────
// This file tests the real requireAuth middleware behaviour.
// UserModel is still mocked to prevent real DB calls.
jest.mock("./db", () => ({
  UserModel: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

describe("Authentication Middleware", () => {
  let app: ReturnType<typeof createApp>;
  let server: Server;

  beforeEach(() => {
    app = createApp();
    server = app.listen(0);
  });

  afterEach((done) => {
    jest.clearAllMocks();
    server.close(done);
  });

  // ─────────────────────────────────────────────────────────
  // 🔐 Protected routes — no token
  // ─────────────────────────────────────────────────────────
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(server).get("/api/users");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: "Authorization header required: Bearer <token>",
    });
  });

  it("returns 403 when token is invalid", async () => {
    const res = await request(server)
      .get("/api/users")
      .set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Invalid token" });
  });

  it("returns 401 when token is expired", async () => {
    // A well-formed but expired JWT
    const expiredToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJ1c2VySWQiOiIxMjMiLCJ1c2VybmFtZSI6InRlc3QiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0." +
      "invalid-signature";
    const res = await request(server)
      .get("/api/users")
      .set("Authorization", `Bearer ${expiredToken}`);
    expect(res.status).toBe(403); // invalid signature → 403
  });

  // ─────────────────────────────────────────────────────────
  // 🌐 Public routes — no token needed
  // ─────────────────────────────────────────────────────────
  it("allows GET / without token", async () => {
    const res = await request(server).get("/");
    expect(res.status).toBe(200);
  });

  it("allows GET /health without token", async () => {
    const res = await request(server).get("/health");
    expect(res.status).toBe(200);
  });

  it("allows POST /auth/login without token", async () => {
    // Will return 400 (bad body) not 401 — proving auth is skipped
    const res = await request(server).post("/auth/login").send({});
    expect(res.status).toBe(400);
  });
});
```

The key insight is that `jest.mock()` is hoisted to the top of the file at compile time and cannot be undone with `jest.unmock()` within the same file reliably. Separating auth tests into their own file where `requireAuth` is never mocked gives clean, predictable behaviour.

```typescript
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
```

Also create `e2e/global-setup.ts`:

```typescript
import { execSync } from "child_process";

export default async function globalSetup() {
  console.log("🌱 Seeding database before E2E tests...");
  execSync("npm run seed --workspace=packages/app", { stdio: "inherit" });
  console.log("✅ Database seeded");
}
```

The only change to `playwright.config.ts` is the `globalSetup` line — everything else is identical to your current config. The global setup runs once before all tests start, after the web servers are ready, ensuring `admin/password123` always exists in the database when the login E2E test runs.
