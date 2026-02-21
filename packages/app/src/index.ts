import { createApp } from "./app";
import { APP_NAME } from "@demo/common";
import { config } from "./config";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`);
  console.log(`📦 Service: ${APP_NAME}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
});

// ─────────────────────────────────────────────────────────────
// 🛑 Graceful Shutdown
// ─────────────────────────────────────────────────────────────
const shutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });

  // ✅ Force exit if server hasn't closed in 10 seconds
  // .unref() ensures this timer doesn't keep the process alive by itself
  setTimeout(() => {
    console.error("⚠️ Forcing shutdown after timeout");
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
  console.error("💥 Uncaught Exception:", error);
  process.exit(1); // always exit - process is in unknown state
});

// Catches rejected Promises that were never .catch()-ed
process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Promise Rejection:", reason);
  process.exit(1);
});

// Export for testing
export { app, server };
