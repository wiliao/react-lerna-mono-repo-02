export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  allowedOrigin: process.env.ALLOWED_ORIGIN || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: (process.env.NODE_ENV || "development") === "development",
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/lerna_demo",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-prod",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
};
