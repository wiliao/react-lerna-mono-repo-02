import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthUserModel } from "../db";
import { config } from "../config";
import { logger } from "../logger";

const router = Router();

const SALT_ROUNDS = 12; // ✅ higher = slower hash = harder to brute force

// ─────────────────────────────────────────────────────────────
// 📝 Register: POST /auth/register
// ─────────────────────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      !username.trim() ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      res.status(400).json({
        error: "username (string) and password (min 8 chars) are required",
      });
      return;
    }

    const exists = await AuthUserModel.findOne({ username });
    if (exists) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    // ✅ bcrypt hash: one-way, salted — safe to store in DB
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await AuthUserModel.create({ username, passwordHash });

    logger.info("✅ User registered", { username });

    // 201 Created — don't return the hash or any sensitive data
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    logger.error("Error registering user", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────
// 🔑 Login: POST /auth/login
// ─────────────────────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    const user = await AuthUserModel.findOne({ username });

    // ✅ CRITICAL: always run bcrypt.compare even if user not found —
    // returning early on "user not found" leaks that the username exists
    // (timing attack). Running the comparison takes the same time either way.
    const dummyHash =
      "$2b$12$invalidhashtopreventtimingattacks00000000000000000000";
    const passwordHash = user ? user.passwordHash : dummyHash;
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!user || !isValid) {
      // ✅ Same error for both "user not found" and "wrong password"
      // Never tell the attacker which one failed
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    // ✅ Sign a JWT with userId and username as payload
    // The secret key ensures only our server can create valid tokens
    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as jwt.SignOptions,
    );

    logger.info("✅ User logged in", { username });

    res.json({
      token, // ✅ client stores this and sends with every request
      expiresIn: config.jwtExpiresIn,
      username: user.username,
    });
  } catch (error) {
    logger.error("Error during login", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
