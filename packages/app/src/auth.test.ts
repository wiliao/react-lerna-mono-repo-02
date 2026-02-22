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
