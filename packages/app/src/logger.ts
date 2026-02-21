import winston from "winston";
import { config } from "./config";

export const logger = winston.createLogger({
  // ✅ Log level hierarchy (lowest to highest):
  // error > warn > info > http > debug
  // Setting "debug" means ALL levels are logged
  // Setting "info" means debug/http are suppressed
  level: config.isDev ? "debug" : "info",

  // ✅ Format: human-readable in dev, structured JSON in prod
  // JSON is important in prod so log aggregators (Datadog, CloudWatch) can parse it
  format: config.isDev
    ? winston.format.combine(
        winston.format.colorize(), // 🎨 colored output in terminal
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
          return `[${timestamp}] ${level}: ${message} ${metaStr}`;
        }),
      )
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(), // 📦 structured JSON for prod log aggregators
      ),

  // ✅ Transports = where logs are sent
  transports: [
    new winston.transports.Console(),
    // In production you could add:
    // new winston.transports.File({ filename: "error.log", level: "error" }),
    // new winston.transports.File({ filename: "combined.log" }),
  ],
});
