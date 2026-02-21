# How To Improve

Your code is already quite solid for a learning project — graceful shutdown, factory pattern, error handling, input validation are all things many beginners miss. Here's what's worth adding:

---

**1. Unhandled promise rejections and uncaught exceptions** (index.ts)

These are process-level safety nets that catch errors that slip past everything else:

```typescript
// index.ts - add after graceful shutdown

process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  process.exit(1); // always exit - process is in unknown state
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Promise Rejection:", reason);
  process.exit(1);
});
```

---

**2. Request logging middleware** (app.ts)

In production you'd use `morgan`, but for learning, a simple manual logger teaches you how middleware works:

```typescript
// app.ts - add before routes
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next(); // ✅ always call next() or the request hangs
});
```

---

**3. Request validation with meaningful errors** (app.ts)

Your ID validation is good. The next concept is validating the request body on POST/PUT routes. Even for learning, adding a POST endpoint demonstrates this:

```typescript
app.post("/api/users", (req: Request, res: Response): void => {
  const { id, name } = req.body;

  // ✅ Validate required fields before touching data
  if (typeof id !== "number" || typeof name !== "string" || !name.trim()) {
    res
      .status(400)
      .json({ error: "id (number) and name (string) are required" });
    return;
  }

  const exists = users.find((u) => u.id === id);
  if (exists) {
    res.status(409).json({ error: "User already exists" }); // 409 Conflict
    return;
  }

  const newUser: User = { id, name: name.trim() };
  users.push(newUser);
  res.status(201).json({ raw: newUser, formatted: formatUser(newUser) }); // 201 Created
});
```

---

**4. Shutdown timeout** (index.ts)

Your graceful shutdown is good but has a gap — if an open connection never closes, the process hangs forever. Add a forced exit as a fallback:

```typescript
const shutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });

  // ✅ Force exit if server hasn't closed in 10 seconds
  setTimeout(() => {
    console.error("⚠️ Forcing shutdown after timeout");
    process.exit(1);
  }, 10_000).unref(); // .unref() so this timer doesn't keep the process alive by itself
};
```

---

**5. CORS should be more explicit** (app.ts)

`cors()` with no options allows all origins — fine for learning, but understanding the options is important:

```typescript
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "http://localhost:3000", // ✅ explicit origin
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
```

---

**6. Environment config pattern** (app.ts)

Hardcoded values scattered across files is a common early mistake. Centralizing config is a key concept:

```typescript
// config.ts - new file
export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  allowedOrigin: process.env.ALLOWED_ORIGIN || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: (process.env.NODE_ENV || "development") === "development",
};
```

Then in `index.ts` and `app.ts`, import from `config.ts` instead of repeating `process.env` logic.

---

**What you already have that many beginners miss:**

The factory pattern (`createApp()`), typed Express handlers, the 4-argument global error handler, input sanitization with regex, graceful shutdown, and separating `index.ts` (server boot) from `app.ts` (app logic) — these are all genuinely good patterns worth noting.

Just two changes needed — install and swap out the manual logger:

```bash
npm install morgan
npm install --save-dev @types/morgan
```

**app.ts** — replace the manual logger middleware with morgan:

```typescript
import morgan from "morgan";

// Remove this manual logger block:
// app.use((req: Request, _res: Response, next: NextFunction) => {
//   if (config.isDev) {
//     console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
//   }
//   next();
// });

// ✅ Replace with morgan - "dev" format: METHOD URL STATUS ms
// "dev"  → colored, concise  (great for development)
// "combined" → Apache format (great for production/log aggregators)
app.use(morgan(config.isDev ? "dev" : "combined"));
```

That's it. Sample output with `"dev"` format:

```bash
GET /health 200 3.217 ms
GET /api/users 200 1.543 ms
GET /api/users/999 404 0.812 ms
```

The `NextFunction` import in `app.ts` can also be removed now since it was only used by the manual logger — though it's still needed for the global error handler signature, so leave it in place.

Good catch — my earlier comment was misleading. Let me clarify:

The `Request` import is **not unused** — it's used in multiple places throughout the file (`app.get`, `app.post`, the error handler, etc.). So that comment was wrong, ignore it.

What I _meant_ to say was much more minor — you can optionally drop the explicit type annotation on `_req` specifically in the 404 handler since Express can infer it:

```typescript
// ✅ With explicit type annotation (what you have - perfectly fine)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ✅ Without annotation on _req - Express infers it (also fine)
app.use((_req, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});
```

Both are correct. It's purely cosmetic and makes no practical difference. The `Request` import stays either way because it's used elsewhere in the file. Sorry for the confusion.

## Logging

Yes, the Node.js equivalent of log4j is **Winston**. It's the most widely used logging library in the Node ecosystem:

```bash
npm install winston
npm install --save-dev @types/winston  # usually not needed, winston ships its own types
```

Create a dedicated logger file:

```typescript
// packages/app/src/logger.ts
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
```

Then replace `console.error/log` in `app.ts` and `index.ts`:

```typescript
// app.ts
import { logger } from "./logger";

// ❌ Before
console.error("Error formatting users:", error);

// ✅ After - second argument is metadata, gets structured in JSON output
logger.error("Error formatting users", { error });
```

```typescript
// index.ts
import { logger } from "./logger";

// ❌ Before
console.log(`🚀 Server running on http://localhost:${config.port}`);
console.log(`📦 Service: ${APP_NAME}`);
console.log(`🌍 Environment: ${config.nodeEnv}`);
console.error("⚠️ Forcing shutdown after timeout");
console.error("💥 Uncaught Exception:", error);
console.error("💥 Unhandled Promise Rejection:", reason);

// ✅ After
logger.info(`🚀 Server running on http://localhost:${config.port}`);
logger.info(`📦 Service: ${APP_NAME}`);
logger.info(`🌍 Environment: ${config.nodeEnv}`);
logger.error("⚠️ Forcing shutdown after timeout");
logger.error("💥 Uncaught Exception", { error });
logger.error("💥 Unhandled Promise Rejection", { reason });
```

You can also plug Winston into Morgan so HTTP request logs flow through the same pipeline:

```typescript
// app.ts - replace the existing morgan line
import { logger } from "./logger";

app.use(
  morgan(config.isDev ? "dev" : "combined", {
    // ✅ Pipe morgan output into winston instead of stdout directly
    stream: {
      write: (message: string) => logger.http(message.trim()),
    },
  }),
);
```

**Dev output** looks like:

```typescript
[2026-02-21T10:00:00.000Z] info: 🚀 Server running on http://localhost:4000
[2026-02-21T10:00:01.123Z] http: GET /api/users 200 1.543 ms
[2026-02-21T10:00:02.456Z] error: Error fetching user {"error": "..."}
```

**Prod output** (JSON, parseable by Datadog/CloudWatch):

```typescript
{"timestamp":"2026-02-21T10:00:00.000Z","level":"info","message":"🚀 Server running on http://localhost:4000"}
{"timestamp":"2026-02-21T10:00:01.123Z","level":"http","message":"GET /api/users 200 1.543 ms"}
```

The key advantage over `console.log` is that in production you get structured JSON with consistent fields, which makes searching and alerting in log aggregators practical.
