// ✅ NO jest.mock() - using REAL @demo/common
import request from "supertest";
import { createApp } from "./app";
import { APP_NAME, formatUser, type User } from "@demo/common";

describe("Express API Endpoints", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  describe("GET /health", () => {
    it("returns 200 with service status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok", service: APP_NAME });
    });
  });

  describe("GET /", () => {
    it("returns backend service name", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.text).toBe(`Backend Service: ${APP_NAME}`);
    });
  });

  describe("GET /api/users", () => {
    it("returns array of formatted users", async () => {
      const res = await request(app).get("/api/users");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      // ✅ Use REAL formatUser - matches your common/index.ts
      const alice: User = { id: 1, name: "Alice" };
      expect(res.body[0]).toEqual({
        raw: alice,
        formatted: formatUser(alice), // "User: Alice (ID: 1)"
      });
    });
  });

  describe("GET /api/users/:id", () => {
    it("returns user when ID exists", async () => {
      const alice: User = { id: 1, name: "Alice" };
      const res = await request(app).get("/api/users/1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        raw: alice,
        formatted: formatUser(alice),
      });
    });

    it("returns 404 when user not found", async () => {
      const res = await request(app).get("/api/users/999");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "User not found" });
    });

    it("returns 400 for invalid ID (non-numeric)", async () => {
      const res = await request(app).get("/api/users/abc");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid user ID" });
    });

    it("returns 400 for float ID", async () => {
      // ✅ Now passes with regex validation
      const res = await request(app).get("/api/users/1.5");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid user ID" });
    });
  });

  describe("404 Handler", () => {
    it("returns 404 for unknown routes", async () => {
      const res = await request(app).get("/nonexistent");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Route not found" });
    });
  });
});
