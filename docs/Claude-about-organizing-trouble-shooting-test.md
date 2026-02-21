# Trouble-shooting Guide

For a Lerna monorepo, the best practice is to **keep test files co-located with the source code inside each package**, rather than having a separate top-level test folder. Here's how it typically looks:

```typescript
my-monorepo/
├── packages/
│   ├── package-a/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── utils.ts
│   │   │   └── __tests__/        ← tests live here, inside the package
│   │   │       ├── index.test.ts
│   │   │       └── utils.test.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── package-b/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       └── index.test.ts
│   │   └── package.json
├── lerna.json
└── package.json
```

**Why co-location is preferred:**

Each package in a monorepo is meant to be self-contained, so keeping tests alongside the code they cover makes each package independently testable, portable, and easier to reason about. It also makes it immediately obvious which code lacks test coverage.

**Two common co-location styles:**

You can use a `__tests__` subfolder (popular with Jest) like shown above, or place test files directly next to the source files using a `.test.ts` / `.spec.ts` suffix:

```typescript
src/
├── utils.ts
├── utils.test.ts    ← sits right next to the file it tests
├── index.ts
└── index.test.ts
```

Both are fine — the `__tests__` folder approach keeps things a bit tidier visually, while the flat approach makes the pairing between source and test extremely obvious.

**What to put at the root level:**

The root of the monorepo should only contain shared configuration, not test files. Things like a root `jest.config.js` (which delegates to each package), a shared `tsconfig.base.json`, ESLint config, and so on. Each package then has its own `jest.config.js` that inherits from it.

**E2E / integration tests** that span multiple packages are the one exception — those can reasonably live in a dedicated top-level folder like `e2e/` or `tests/integration/`, since they don't belong to any single package.

In short: no separate top-level test folder for unit/integration tests — keep them inside each package they belong to.

Here's the updated config with both web servers properly configured:

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

The key changes from your original:

`timeout` added to both servers — without this, Playwright uses a default of 60s which is often not enough for webpack's first cold build. 120s for the frontend gives it breathing room.

`stdout: "pipe"` and `stderr: "pipe"` on both servers — this surfaces server startup logs directly in your Playwright terminal output, which is invaluable when debugging why a server failed to start.

Everything else was already correct — `reuseExistingServer: !process.env.CI` is the right pattern so local dev reuses a running server while CI always starts fresh.

The E2E tests are passing now — great progress!

For the flaky test warning, we need to find the root cause first. Can you share the test file for `@demo/app`? It's likely in `packages/app/src/__tests__/` or similar.

In the meantime, here are the most common causes of flaky tests in an Express/Node app package and how to fix each:

**1. Port conflicts between test runs** — if your app starts a real server in tests without closing it properly:

```typescript
// ✅ Always close the server in afterAll
let server: Server;

beforeAll(() => {
  server = app.listen(0); // port 0 = random available port, avoids conflicts
});

afterAll((done) => {
  server.close(done);
});
```

**2. Async tests without proper awaiting** — a test that resolves before async work finishes:

```typescript
// ❌ Flaky - fire and forget
it("should do something", () => {
  fetchData().then((result) => expect(result).toBe("ok"));
});

// ✅ Properly awaited
it("should do something", async () => {
  const result = await fetchData();
  expect(result).toBe("ok");
});
```

**3. Shared mutable state between tests** — if tests modify a shared object without resetting it:

```typescript
// ✅ Reset state before each test
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});
```

**4. Timer-dependent tests** — anything relying on `setTimeout` or `Date.now()` is inherently flaky:

```typescript
// ✅ Use fake timers instead
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("fires after delay", () => {
  const fn = jest.fn();
  setTimeout(fn, 1000);
  jest.runAllTimers(); // ✅ deterministic, no real waiting
  expect(fn).toHaveBeenCalled();
});
```

**5. Add retries to Jest config as a safety net** — while you investigate, add this to `packages/app/jest.config.js`:

```javascript
module.exports = {
  // ... existing config
  retries: 2, // ✅ retry flaky tests up to 2 times (jest-circus only)
};
```

If you share the actual test file, I can pinpoint exactly which issue applies to your case.

Your test code looks solid — `beforeEach` creating a fresh app instance, no shared state, proper async/await throughout. The flakiness is almost certainly **not a code bug** but rather an **environmental/timing issue with Supertest and open handles**.

The most common culprit is that Supertest keeps the HTTP server open between tests, which causes Jest to detect lingering async operations and report the task as flaky.

Add this to `packages/app/jest.config.js`:

```javascript
module.exports = {
  // ... existing config
  testEnvironment: "node",
  detectOpenHandles: true, // ✅ confirms if open handles are the cause
  forceExit: true, // ✅ force Jest to exit after all tests complete
};
```

And update your test file to explicitly close the server after each test:

```typescript
import request from "supertest";
import { createApp } from "./app";
import { APP_NAME, formatUser, type User } from "@demo/common";
import { Server } from "http";

describe("Express API Endpoints", () => {
  let app: ReturnType<typeof createApp>;
  let server: Server; // ✅ track the server instance

  beforeEach(() => {
    app = createApp();
    server = app.listen(0); // ✅ port 0 = random port, avoids conflicts
  });

  afterEach((done) => {
    server.close(done); // ✅ cleanly close after every test
  });

  describe("GET /health", () => {
    it("returns 200 with service status", async () => {
      const res = await request(server).get("/health"); // ✅ use server, not app
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok", service: APP_NAME });
    });
  });

  describe("GET /", () => {
    it("returns backend service name", async () => {
      const res = await request(server).get("/");
      expect(res.status).toBe(200);
      expect(res.text).toBe(`Backend Service: ${APP_NAME}`);
    });
  });

  describe("GET /api/users", () => {
    it("returns array of formatted users", async () => {
      const res = await request(server).get("/api/users");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const alice: User = { id: 1, name: "Alice" };
      expect(res.body[0]).toEqual({
        raw: alice,
        formatted: formatUser(alice),
      });
    });
  });

  describe("GET /api/users/:id", () => {
    it("returns user when ID exists", async () => {
      const alice: User = { id: 1, name: "Alice" };
      const res = await request(server).get("/api/users/1");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ raw: alice, formatted: formatUser(alice) });
    });

    it("returns 404 when user not found", async () => {
      const res = await request(server).get("/api/users/999");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "User not found" });
    });

    it("returns 400 for invalid ID (non-numeric)", async () => {
      const res = await request(server).get("/api/users/abc");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid user ID" });
    });

    it("returns 400 for float ID", async () => {
      const res = await request(server).get("/api/users/1.5");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid user ID" });
    });
  });

  describe("404 Handler", () => {
    it("returns 404 for unknown routes", async () => {
      const res = await request(server).get("/nonexistent");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Route not found" });
    });
  });
});
```

The two key changes are:

**`app.listen(0)` in `beforeEach`** — port `0` tells the OS to assign a random available port, so multiple test workers never fight over the same port. This alone fixes a large class of flakiness.

**`request(server)` instead of `request(app)`** — when you pass the Express `app` directly to Supertest, it spins up its own internal server and sometimes doesn't clean it up. Passing the explicit `server` instance gives you full control, and `server.close(done)` in `afterEach` ensures it's torn down cleanly every time.

Everything is clean now! Here's a summary of what was accomplished in this session:

**Problems solved:**

- Playwright browsers not installed → `npx playwright install`
- Flaky `@demo/app:test` → fixed by using `app.listen(0)` (random port) + explicit `server.close()` in `afterEach` + passing `server` instead of `app` to Supertest
- Playwright config missing server timeouts and log piping → added `timeout` and `stdout/stderr: "pipe"` to both `webServer` entries

**Final test pipeline is:**

```typescript
npm run test:full
  ├── lerna run test          (unit + integration tests for all packages)
  │     ├── @demo/common:test ✅
  │     └── @demo/app:test    ✅  (no longer flaky)
  └── playwright test         (E2E across both servers)
        ├── homepage loads and shows expected content ✅
        └── API health check works                   ✅
```

A couple of things worth keeping in mind going forward — add `npx playwright install` to your CI setup script so browsers are always available in fresh environments, and the `detectOpenHandles: true` in your Jest config is worth keeping during development as an early warning system if you introduce new async resources that aren't cleaned up properly.

```typescript
import request from "supertest";
import { createApp } from "./app";
import { APP_NAME, formatUser, type User } from "@demo/common";
import { Server } from "http";

// ─────────────────────────────────────────────────────────────
// 🧪 Top-Level Test Suite: All Express API Endpoint Tests
// ─────────────────────────────────────────────────────────────
// ✅ NO jest.mock() - using REAL @demo/common
// This is an INTEGRATION test: we test the real app with real dependencies,
// not isolated units. This catches issues that unit tests might miss.
describe("Express API Endpoints", () => {
  // App instance scoped to this describe block
  let app: ReturnType<typeof createApp>;
  // Server instance used to control lifecycle (start/stop) around each test
  let server: Server;

  // ✅ CRITICAL: Create fresh app instance AND start a real server before EACH test.
  // - Fresh app ensures tests don't share state (e.g., modified users array)
  // - port 0 = OS assigns a random available port, preventing port conflicts
  //   when tests run in parallel or sequentially without cleanup
  beforeEach(() => {
    app = createApp();
    server = app.listen(0); // ✅ port 0 = random port, avoids conflicts
  });

  // ✅ CRITICAL: Close the server after EACH test.
  // Passing `done` to server.close() ensures Jest waits for the server
  // to fully close before moving on — prevents open handle warnings
  // and eliminates the flaky test detection by Nx/Lerna.
  afterEach((done) => {
    server.close(done); // ✅ cleanly close after every test
  });

  // ─────────────────────────────────────────────────────────
  // 🏥 Health Check Endpoint: Basic Service Availability
  // ─────────────────────────────────────────────────────────
  describe("GET /health", () => {
    it("returns 200 with service status", async () => {
      // ✅ Pass `server` (not `app`) to Supertest — gives us full lifecycle control
      // When passing `app`, Supertest creates its own internal server and may
      // not clean it up, leading to open handles and flaky test detection.
      const res = await request(server).get("/health");

      // Assert HTTP 200 OK status (standard for successful GET)
      expect(res.status).toBe(200);

      // Assert response body matches expected contract:
      // { status: "ok", service: "<APP_NAME>" }
      // This validates the endpoint structure hasn't accidentally changed.
      expect(res.body).toEqual({ status: "ok", service: APP_NAME });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 🏠 Root Endpoint: Simple Service Identification
  // ─────────────────────────────────────────────────────────
  describe("GET /", () => {
    it("returns backend service name", async () => {
      const res = await request(server).get("/");

      expect(res.status).toBe(200);

      // Note: .text for string responses, .body for JSON responses
      // This endpoint returns plain text, not JSON.
      expect(res.text).toBe(`Backend Service: ${APP_NAME}`);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 👥 GET /api/users: List All Users (Happy Path)
  // ─────────────────────────────────────────────────────────
  describe("GET /api/users", () => {
    it("returns array of formatted users", async () => {
      const res = await request(server).get("/api/users");

      // 1️⃣ Validate HTTP response
      expect(res.status).toBe(200);

      // 2️⃣ Validate response structure: must be an array
      expect(Array.isArray(res.body)).toBe(true);

      // 3️⃣ Validate business logic: we have exactly 2 mock users
      expect(res.body).toHaveLength(2);

      // 4️⃣ Validate data transformation: each user is wrapped with raw + formatted
      // ✅ Using REAL formatUser() from @demo/common - this is integration testing!
      // If formatUser changes, this test will fail, alerting us to breaking changes.
      const alice: User = { id: 1, name: "Alice" };
      expect(res.body[0]).toEqual({
        raw: alice, // Original user object
        formatted: formatUser(alice), // Transformed via shared utility
      });
      // Expected: { raw: {id:1,name:"Alice"}, formatted:"User: Alice (ID: 1)" }
    });
  });

  // ─────────────────────────────────────────────────────────
  // 👤 GET /api/users/:id: Fetch Single User (Multiple Scenarios)
  // ─────────────────────────────────────────────────────────
  describe("GET /api/users/:id", () => {
    // ✅ Scenario 1: Valid ID → Return user (Happy Path)
    it("returns user when ID exists", async () => {
      const alice: User = { id: 1, name: "Alice" };
      const res = await request(server).get("/api/users/1");

      expect(res.status).toBe(200);

      // Assert response contains both raw data AND formatted output
      // This validates the endpoint contract: frontend knows what to expect.
      expect(res.body).toEqual({
        raw: alice,
        formatted: formatUser(alice),
      });
    });

    // ✅ Scenario 2: Valid ID format, but user doesn't exist → 404
    it("returns 404 when user not found", async () => {
      const res = await request(server).get("/api/users/999");

      // 404 = Resource Not Found (standard HTTP semantics)
      expect(res.status).toBe(404);

      // Error response format should be consistent across the API
      expect(res.body).toEqual({ error: "User not found" });
    });

    // ✅ Scenario 3: Invalid ID format (non-numeric string) → 400
    it("returns 400 for invalid ID (non-numeric)", async () => {
      const res = await request(server).get("/api/users/abc");

      // 400 = Bad Request (client sent invalid data)
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid user ID" });
    });

    // ✅ Scenario 4: Float ID like "1.5" → 400 (Edge Case!)
    // This is important: parseInt("1.5") === 1, which could cause bugs.
    // Our app uses regex validation: !/^\d+$/.test(userIdParam)
    it("returns 400 for float ID", async () => {
      // ✅ This test validates our ID validation logic rejects floats
      const res = await request(server).get("/api/users/1.5");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid user ID" });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 🚫 Global 404 Handler: Catch-All for Undefined Routes
  // ─────────────────────────────────────────────────────────
  describe("404 Handler", () => {
    it("returns 404 for unknown routes", async () => {
      // Request a route that doesn't exist in our Express app
      const res = await request(server).get("/nonexistent");

      // Should trigger the catch-all middleware: app.use((req, res) => {...})
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Route not found" });
    });
  });
});
```

All original comments are restored, with two additions — an explanation on the `server` variable declaration clarifying its role in lifecycle control, and an expanded comment on the `beforeEach` block explaining why `port 0` specifically solves the flakiness issue.
