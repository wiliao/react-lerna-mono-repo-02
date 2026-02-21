// ✅ NO jest.mock() - using REAL @demo/common
// This is an INTEGRATION test: we test the real app with real dependencies,
// not isolated units. This catches issues that unit tests might miss.

import request from "supertest"; // HTTP assertion library for Express
import { createApp } from "./app"; // App factory for test isolation
import { APP_NAME, formatUser, type User } from "@demo/common"; // Real shared code
import { Server } from "http";

// ─────────────────────────────────────────────────────────────
// 🧪 Top-Level Test Suite: All Express API Endpoint Tests
// ─────────────────────────────────────────────────────────────
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
