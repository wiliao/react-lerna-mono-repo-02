import { createApp } from "./app";
import { APP_NAME } from "@demo/common";
import { config } from "./config";
import { logger } from "./logger";
import { connectDB } from "./db";

const app = createApp();

// ✅ Wrap in async function — works with CommonJS ("module": "commonjs" in tsconfig)
async function main() {
  await connectDB(config.mongoUri);

  const server = app.listen(config.port, () => {
    logger.info(`🚀 Server running on http://localhost:${config.port}`);
    logger.info(`📦 Service: ${APP_NAME}`);
    logger.info(`🌍 Environment: ${config.nodeEnv}`);
  });

  // ─────────────────────────────────────────────────────────────
  // 🛑 Graceful Shutdown
  // ─────────────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      logger.info("✅ Server closed");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("⚠️ Forcing shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// ─────────────────────────────────────────────────────────────
// 💥 Process-Level Safety Nets
// ─────────────────────────────────────────────────────────────
process.on("uncaughtException", (error) => {
  logger.error("💥 Uncaught Exception", { error });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("💥 Unhandled Promise Rejection", { reason });
  process.exit(1);
});

// ✅ Start the app — unhandledRejection above catches any startup failures
main();

export { app };
