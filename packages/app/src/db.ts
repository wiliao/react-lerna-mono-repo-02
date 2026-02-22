import mongoose from "mongoose";
import { logger } from "./logger";
import bcrypt from "bcrypt";

// ✅ Call this once in index.ts before app.listen()
export async function connectDB(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri);
    logger.info("✅ MongoDB connected");
  } catch (error) {
    logger.error("💥 MongoDB connection failed", { error });
    process.exit(1); // can't run without a database
  }
}

// ✅ Mongoose schema — replaces the in-memory users array
const userSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
});

// ─────────────────────────────────────────────────────────────
// 🔐 Auth User Schema
// ─────────────────────────────────────────────────────────────
// Separate from the app's User model — stores credentials only.
// Passwords are NEVER stored in plain text — bcrypt hashes them.
const authUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true }, // ✅ never store plain password
  createdAt: { type: Date, default: Date.now },
});

// ✅ Instance method to verify a password attempt
authUserSchema.methods.verifyPassword = async function (
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

export const AuthUserModel = mongoose.model("AuthUser", authUserSchema);
export const UserModel = mongoose.model("User", userSchema);
