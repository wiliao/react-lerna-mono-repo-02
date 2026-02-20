import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { APP_NAME, formatUser, User } from "@demo/common";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Mock data (could be injected for advanced testing)
  const users: User[] = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: APP_NAME });
  });

  app.get("/", (_req: Request, res: Response) => {
    res.send(`Backend Service: ${APP_NAME}`);
  });

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

  app.get("/api/users/:id", (req: Request, res: Response): void => {
    try {
      const userIdParam = req.params.id;
      const userId = parseInt(userIdParam, 10);

      // ✅ Proper validation: reject non-integers, floats, NaN, negatives
      if (isNaN(userId) || !/^\d+$/.test(userIdParam)) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }

      const user = users.find((u) => u.id === userId);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        raw: user,
        formatted: formatUser(user),
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Route not found" });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
