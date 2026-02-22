import request from "supertest";
import { createApp } from "./app";
import { APP_NAME, formatUser, type User } from "@demo/common";
import { Server } from "http";

// ─────────────────────────────────────────────────────────────
// 🧪 Mock UserModel — prevents real MongoDB calls in tests
// ─────────────────────────────────────────────────────────────
// Routes now use Mongoose which requires a live DB connection.
// We mock UserModel at the module level so tests stay fast,
// deterministic, and runnable without Docker.
jest.mock("./db", () => ({
  UserModel: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

// Import AFTER jest.mock() so we get the mocked version
import { UserModel } from "./db";

// ─────────────────────────────────────────────────────────────
// 🧪 Top-Level Test Suite: All Express API Endpoint Tests
// ─────────────────────────────────────────────────────────────
// This is an INTEGRATION test: we test the real Express app with
// real middleware, but with the database layer mocked out.
describe("Express API Endpoints", () => {
  let app: ReturnType<typeof createApp>;
  let server: Server;

  // Mock data — mirrors what MongoDB would return
  const mockAlice = { id: 1, name: "Alice" };
  const mockBob = { id: 2, name: "Bob" };

  // ✅ Fresh app + server before each test
  // port 0 = random port, avoids conflicts
  beforeEach(() => {
    app = createApp();
    server = app.listen(0);
  });

  // ✅ Close server AND clear all mocks after each test
  // Prevents mock call counts leaking between tests
  afterEach((done) => {
    jest.clearAllMocks();
    server.close(done);
  });

  // ─────────────────────────────────────────────────────────
  // 🏥 Health Check: GET /health
  // ─────────────────────────────────────────────────────────
  describe("GET /health", () => {
    it("returns 200 with service status", async () => {
      const res = await request(server).get("/health");

      expect(res.status).toBe(200);

      // ✅ toMatchObject: passes even if uptime/timestamp are added
      expect(res.body).toMatchObject({ status: "ok", service: APP_NAME });
      expect(typeof res.body.uptime).toBe("number");
      expect(typeof res.body.timestamp).toBe("string");
    });
  });

  // ─────────────────────────────────────────────────────────
  // 🏠 Root: GET /
  // ─────────────────────────────────────────────────────────
  describe("GET /", () => {
    it("returns backend service name", async () => {
      const res = await request(server).get("/");

      expect(res.status).toBe(200);
      expect(res.text).toBe(`Backend Service: ${APP_NAME}`);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 👥 GET /api/users
  // ─────────────────────────────────────────────────────────
  describe("GET /api/users", () => {
    it("returns array of formatted users", async () => {
      // ✅ Tell the mock what UserModel.find() should return
      (UserModel.find as jest.Mock).mockResolvedValue([mockAlice, mockBob]);

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

    it("returns 500 when database throws", async () => {
      // ✅ Simulate a database failure
      (UserModel.find as jest.Mock).mockRejectedValue(new Error("DB error"));

      const res = await request(server).get("/api/users");

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Internal server error" });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 👤 GET /api/users/:id
  // ─────────────────────────────────────────────────────────
  describe("GET /api/users/:id", () => {
    // ✅ Scenario 1: Valid ID → Return user (Happy Path)
    it("returns user when ID exists", async () => {
      (UserModel.findOne as jest.Mock).mockResolvedValue(mockAlice);

      const alice: User = { id: 1, name: "Alice" };
      const res = await request(server).get("/api/users/1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        raw: alice,
        formatted: formatUser(alice),
      });
    });

    // ✅ Scenario 2: Valid ID format but user doesn't exist → 404
    it("returns 404 when user not found", async () => {
      // ✅ null = Mongoose findOne found nothing
      (UserModel.findOne as jest.Mock).mockResolvedValue(null);

      const res = await request(server).get("/api/users/999");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "User not found" });
    });

    // ✅ Scenario 3: Invalid ID format → 400 (no DB call needed)
    it("returns 400 for invalid ID (non-numeric)", async () => {
      const res = await request(server).get("/api/users/abc");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid user ID" });
    });

    // ✅ Scenario 4: Float ID → 400 (edge case)
    it("returns 400 for float ID", async () => {
      const res = await request(server).get("/api/users/1.5");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid user ID" });
    });
  });

  // ─────────────────────────────────────────────────────────
  // ➕ POST /api/users
  // ─────────────────────────────────────────────────────────
  describe("POST /api/users", () => {
    it("creates a new user", async () => {
      (UserModel.findOne as jest.Mock).mockResolvedValue(null); // no duplicate
      (UserModel.create as jest.Mock).mockResolvedValue({
        id: 3,
        name: "Charlie",
      });

      const res = await request(server)
        .post("/api/users")
        .send({ id: 3, name: "Charlie" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        raw: { id: 3, name: "Charlie" },
        formatted: formatUser({ id: 3, name: "Charlie" }),
      });
    });

    it("returns 409 when user already exists", async () => {
      (UserModel.findOne as jest.Mock).mockResolvedValue(mockAlice); // duplicate

      const res = await request(server)
        .post("/api/users")
        .send({ id: 1, name: "Alice" });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "User already exists" });
    });

    it("returns 400 for missing fields", async () => {
      const res = await request(server)
        .post("/api/users")
        .send({ name: "NoId" }); // missing id

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "id (number) and name (string) are required",
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 🚫 404 Handler
  // ─────────────────────────────────────────────────────────
  describe("404 Handler", () => {
    it("returns 404 for unknown routes", async () => {
      const res = await request(server).get("/nonexistent");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Route not found" });
    });
  });
});
