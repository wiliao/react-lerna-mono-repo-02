import { createApp } from "./app";
import { APP_NAME } from "@demo/common";
import { config } from "./config";
import { logger } from "./logger";

const app = createApp();

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

  // ✅ Force exit if server hasn't closed in 10 seconds
  // .unref() ensures this timer doesn't keep the process alive by itself
  setTimeout(() => {
    logger.error("⚠️ Forcing shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ─────────────────────────────────────────────────────────────
// 💥 Process-Level Safety Nets
// ─────────────────────────────────────────────────────────────

// Catches synchronous errors that were never caught anywhere in the call stack
process.on("uncaughtException", (error) => {
  logger.error("💥 Uncaught Exception", { error });
  process.exit(1); // always exit - process is in unknown state
});

// Catches rejected Promises that were never .catch()-ed
process.on("unhandledRejection", (reason) => {
  logger.error("💥 Unhandled Promise Rejection", { reason });
  process.exit(1);
});

// Export for testing
export { app, server };
