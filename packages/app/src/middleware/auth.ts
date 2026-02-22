import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { logger } from "../logger";

// ✅ Extend Express Request type to carry the decoded user
export interface AuthRequest extends Request {
  user?: { userId: string; username: string };
}

// ─────────────────────────────────────────────────────────────
// 🔑 JWT Authentication Middleware
// ─────────────────────────────────────────────────────────────
// Verifies the Bearer token in the Authorization header.
// On success, attaches decoded user to req.user for route handlers.
// Public routes (/, /health, /auth/*) are excluded.
export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  // ✅ Skip auth for public routes
  const publicRoutes = ["/", "/health", "/auth/login", "/auth/register"];
  if (publicRoutes.includes(req.path)) {
    next();
    return;
  }

  const authHeader = req.headers["authorization"];

  // 401 = no credentials provided
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "Authorization header required: Bearer <token>" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    // ✅ verify() checks signature AND expiry — throws if either fails
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      username: string;
    };

    req.user = decoded; // ✅ attach to request for use in route handlers
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // 401 = credentials expired, client should re-login
      res.status(401).json({ error: "Token expired — please log in again" });
      return;
    }
    // 403 = token present but invalid (tampered, wrong secret)
    logger.warn("🚫 Invalid JWT", { error });
    res.status(403).json({ error: "Invalid token" });
  }
}
