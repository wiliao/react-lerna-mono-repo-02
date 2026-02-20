import { createApp } from "./app";
import { APP_NAME } from "@demo/common";

const app = createApp();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Service: ${APP_NAME}`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Export for testing
export { app, server };
