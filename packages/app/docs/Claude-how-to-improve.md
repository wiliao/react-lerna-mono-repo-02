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
