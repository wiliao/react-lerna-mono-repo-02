import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { config } from "./config";
import { UserModel, AuthUserModel } from "./db"; // ✅ import AuthUserModel
import { logger } from "./logger";

async function seed() {
  await mongoose.connect(config.mongoUri);
  logger.info("✅ MongoDB connected");

  // ─────────────────────────────────────────────────────────────
  // 🗄️ Seed app users
  // ─────────────────────────────────────────────────────────────
  await UserModel.deleteMany({});
  logger.info("🗑️  Cleared existing users");

  await UserModel.insertMany([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
  logger.info("🌱 Seeded 2 users");

  // ─────────────────────────────────────────────────────────────
  // 🔐 Seed auth users
  // ─────────────────────────────────────────────────────────────
  await AuthUserModel.deleteMany({});
  logger.info("🗑️  Cleared existing auth users");

  const passwordHash = await bcrypt.hash("password123", 12);
  await AuthUserModel.create({ username: "admin", passwordHash });
  logger.info("🌱 Seeded auth user: admin / password123");

  // ─────────────────────────────────────────────────────────────
  // 👋 Disconnect cleanly
  // ─────────────────────────────────────────────────────────────
  await mongoose.disconnect();
  logger.info("👋 Done");
}

seed().catch((error) => {
  logger.error("💥 Seed failed", { error });
  process.exit(1);
});
