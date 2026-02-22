import "dotenv/config"; // ✅ must be first — loads .env before config.ts reads process.env
import mongoose from "mongoose";
import { config } from "./config";
import { UserModel } from "./db";
import { logger } from "./logger";

async function seed() {
  await mongoose.connect(config.mongoUri);
  logger.info("✅ MongoDB connected");

  await UserModel.deleteMany({});
  logger.info("🗑️  Cleared existing users");

  await UserModel.insertMany([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
  logger.info("🌱 Seeded 2 users");

  await mongoose.disconnect();
  logger.info("👋 Done");
}

seed().catch((error) => {
  logger.error("💥 Seed failed", { error });
  process.exit(1);
});
