import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import { logger } from "./logger";
import { APP_NAME, formatUser } from "@demo/common";
import { config } from "./config";
import { UserModel } from "./db";

export function createApp() {
  const app = express();

  // ─────────────────────────────────────────────────────────────
  // ⚙️ Middleware
  // ─────────────────────────────────────────────────────────────
  // ✅ Order matters in Express — middleware runs top to bottom:
  // helmet → cors → json → morgan → rateLimit → routes

  // ✅ helmet first: sets secure HTTP headers before anything else is processed
  app.use(helmet());

  // ✅ CORS second: reject disallowed origins before parsing body or logging
  app.use(
    cors({
      origin: config.allowedOrigin,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // ✅ Parse JSON body before routes need to read req.body
  // limit: reject oversized payloads to prevent DoS attacks
  app.use(express.json({ limit: "10kb" }));

  // ✅ Morgan after body parsing so request details are fully available
  // Piped into Winston so all logs flow through the same pipeline
  app.use(
    morgan(config.isDev ? "dev" : "combined", {
      stream: {
        write: (message: string) => logger.http(message.trim()),
      },
    }),
  );

  // ✅ Rate limiting after logging so all requests (including blocked ones) are logged
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per window
      message: { error: "Too many requests, please try again later" },
    }),
  );

  // ─────────────────────────────────────────────────────────────
  // 🏥 Health Check: GET /health
  // ─────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: APP_NAME,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
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
  app.get("/api/users", async (_req: Request, res: Response) => {
    try {
      // ✅ { _id: 0, __v: 0 } excludes Mongo internal fields from the response
      const users = await UserModel.find({}, { _id: 0, __v: 0 });

      const formattedUsers = users.map((u) => ({
        raw: { id: u.id, name: u.name },
        formatted: formatUser({ id: u.id, name: u.name }),
      }));

      res.json(formattedUsers);
    } catch (error) {
      logger.error("Error fetching users", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 👤 Get User by ID: GET /api/users/:id
  // ─────────────────────────────────────────────────────────────
  app.get(
    "/api/users/:id",
    async (req: Request, res: Response): Promise<void> => {
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

        // ✅ findOne returns null if not found — no need for array .find()
        const user = await UserModel.findOne(
          { id: userId },
          { _id: 0, __v: 0 },
        );

        if (!user) {
          res.status(404).json({ error: "User not found" });
          return;
        }

        res.json({
          raw: { id: user.id, name: user.name },
          formatted: formatUser({ id: user.id, name: user.name }),
        });
      } catch (error) {
        logger.error("Error fetching user", { error });
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────
  // ➕ Create User: POST /api/users
  // ─────────────────────────────────────────────────────────────
  app.post("/api/users", async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, name } = req.body;

      // ✅ Validate required fields before touching the database
      if (typeof id !== "number" || typeof name !== "string" || !name.trim()) {
        res
          .status(400)
          .json({ error: "id (number) and name (string) are required" });
        return;
      }

      // ✅ Check for duplicate before inserting
      // 409 Conflict = resource already exists (more accurate than 400)
      const exists = await UserModel.findOne({ id });
      if (exists) {
        res.status(409).json({ error: "User already exists" });
        return;
      }

      // ✅ UserModel.create() inserts and returns the new document
      const newUser = await UserModel.create({ id, name: name.trim() });

      // 201 Created = new resource was successfully created (not 200)
      res.status(201).json({
        raw: { id: newUser.id, name: newUser.name },
        formatted: formatUser({ id: newUser.id, name: newUser.name }),
      });
    } catch (error) {
      logger.error("Error creating user", { error });
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
    logger.error("Unhandled error", { error: err });
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
