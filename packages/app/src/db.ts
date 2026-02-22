import mongoose from "mongoose";
import { logger } from "./logger";

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

export const UserModel = mongoose.model("User", userSchema);
