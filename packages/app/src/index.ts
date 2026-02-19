import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { APP_NAME, formatUser, User } from "@demo/common";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Mock data
const users: User[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

// ✅ Health check (unchanged)
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: APP_NAME });
});

// ✅ Root endpoint (unchanged)
app.get("/", (_req: Request, res: Response) => {
  res.send(`Backend Service: ${APP_NAME}`);
});

// ✅ Get all users - RETURN ARRAY DIRECTLY (no wrapper)
app.get("/api/users", (_req: Request, res: Response) => {
  try {
    const formattedUsers = users.map((u) => ({
      raw: u,
      formatted: formatUser(u),
    }));
    // ✅ FIXED: Return plain array, not { success, data }
    res.json(formattedUsers);
  } catch (error) {
    console.error("Error formatting users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Get user by ID - RETURN OBJECT DIRECTLY (no wrapper)
app.get("/api/users/:id", (req: Request, res: Response): void => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const user = users.find((u) => u.id === userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // ✅ FIXED: Return plain object, not { success, data }
    res.json({
      raw: user,
      formatted: formatUser(user),
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ 404 handler (unchanged)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ✅ Global error handler (unchanged)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ✅ Start server (unchanged)
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Service: ${APP_NAME}`);
});

// ✅ Graceful shutdown (unchanged)
process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
