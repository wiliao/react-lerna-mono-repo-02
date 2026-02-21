import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import { logger } from "./logger";
import { APP_NAME, formatUser, User } from "@demo/common";
import { config } from "./config";

export function createApp() {
  const app = express();

  // ─────────────────────────────────────────────────────────────
  // ⚙️ Middleware
  // ─────────────────────────────────────────────────────────────

  // ✅ Explicit CORS config: only allow requests from our known frontend origin
  // In dev this is localhost:3000; in prod set ALLOWED_ORIGIN env var
  app.use(
    cors({
      origin: config.allowedOrigin,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(express.json());

  app.use(
    morgan(config.isDev ? "dev" : "combined", {
      // ✅ Pipe morgan output into winston instead of stdout directly
      stream: {
        write: (message: string) => logger.http(message.trim()),
      },
    }),
  );

  // ─────────────────────────────────────────────────────────────
  // 🗄️ Mock Data
  // ─────────────────────────────────────────────────────────────
  // Could be injected via createApp(users) for more advanced testing
  const users: User[] = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];

  // ─────────────────────────────────────────────────────────────
  // 🏥 Health Check: GET /health
  // ─────────────────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: APP_NAME });
  });

  // ─────────────────────────────────────────────────────────────
  // 🏠 Root: GET /
  // ─────────────────────────────────────────────────────────────
  app.get("/", (_req: Request, res: Response) => {
    res.send(`Backend Service: ${APP_NAME}`);
  });

  // ─────────────────────────────────────────────────────────────
  // 👥 List Users: GET /api/users
  // ─────────────────────────────────────────────────────────────
  app.get("/api/users", (_req: Request, res: Response) => {
    try {
      const formattedUsers = users.map((u) => ({
        raw: u,
        formatted: formatUser(u),
      }));
      res.json(formattedUsers);
    } catch (error) {
      console.error("Error formatting users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 👤 Get User by ID: GET /api/users/:id
  // ─────────────────────────────────────────────────────────────
  app.get("/api/users/:id", (req: Request, res: Response): void => {
    try {
      // ✅ Handle string | string[] type from Express params
      const userIdParam = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const userId = parseInt(userIdParam, 10);

      // Reject if: NaN, float, negative, or non-numeric string
      // e.g. "abc", "1.5", "-1" all fail this check
      if (isNaN(userId) || !/^\d+$/.test(userIdParam)) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }

      const user = users.find((u) => u.id === userId);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({ raw: user, formatted: formatUser(user) });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // ➕ Create User: POST /api/users
  // ─────────────────────────────────────────────────────────────
  app.post("/api/users", (req: Request, res: Response): void => {
    try {
      const { id, name } = req.body;

      // ✅ Validate required fields before touching data
      if (typeof id !== "number" || typeof name !== "string" || !name.trim()) {
        res
          .status(400)
          .json({ error: "id (number) and name (string) are required" });
        return;
      }

      // 409 Conflict = resource already exists (more accurate than 400)
      const exists = users.find((u) => u.id === id);
      if (exists) {
        res.status(409).json({ error: "User already exists" });
        return;
      }

      const newUser: User = { id, name: name.trim() };
      users.push(newUser);

      // 201 Created = new resource was successfully created (not 200)
      res.status(201).json({ raw: newUser, formatted: formatUser(newUser) });
    } catch (error) {
      logger.error("Error formatting users", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 🚫 404 Handler: catch-all for undefined routes
  // Must be registered AFTER all valid routes
  // ─────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Route not found" });
  });

  // ─────────────────────────────────────────────────────────────
  // 💥 Global Error Handler
  // 4 arguments are REQUIRED - Express identifies this as an error
  // handler specifically because of the (err, req, res, next) signature
  // ─────────────────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
