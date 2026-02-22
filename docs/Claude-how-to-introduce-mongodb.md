# MongoDB Setup, Verification & Production To-Do

> Lerna Monorepo Demo — `react-lerna-mono-repo-02`

---

## 🍃 MongoDB Setup Process

### 1. Docker Compose Configuration

Add `docker-compose.yml` at the repo root:

```yaml
# ⚠️ Remove "version" attribute — it is obsolete in modern Docker Compose
services:
  # ─────────────────────────────────────────────────────────────
  # 🍃 MongoDB
  # ─────────────────────────────────────────────────────────────
  mongo:
    image: mongo:8.2
    container_name: demo_mongo
    restart: unless-stopped
    ports:
      - "27017:27017" # expose to host for local dev tools (Compass etc.)
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
      MONGO_INITDB_DATABASE: ${MONGO_DB}
    volumes:
      - mongo_data:/data/db # persist data across container restarts
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─────────────────────────────────────────────────────────────
  # 📦 Backend API
  # ─────────────────────────────────────────────────────────────
  app:
    build:
      context: .
      dockerfile: packages/app/Dockerfile
    container_name: demo_app
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      PORT: 4000
      NODE_ENV: production
      ALLOWED_ORIGIN: http://localhost:3000
      MONGO_URI: mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo:27017/${MONGO_DB}?authSource=admin
    depends_on:
      mongo:
        condition: service_healthy # wait for mongo to be ready before starting app

volumes:
  mongo_data:
```

### 2. Environment Variables

```bash
# packages/app/.env  (never commit — add to .gitignore)
PORT=4000
ALLOWED_ORIGIN=http://localhost:3000
NODE_ENV=development
MONGO_URI=mongodb://admin:supersecretpassword@localhost:27017/lerna_demo?authSource=admin

# packages/app/.env.example  (commit this — tells teammates what vars are needed)
PORT=4000
ALLOWED_ORIGIN=http://localhost:3000
NODE_ENV=development
MONGO_URI=mongodb://admin:changeme@localhost:27017/lerna_demo?authSource=admin
```

> ⚠️ `authSource=admin` is required — the root user is created in the `admin`
> database by `MONGO_INITDB_ROOT_USERNAME`, even though your data lives in `lerna_demo`.
> Without it, every query throws `Command requires authentication`.

### 3. Config (`packages/app/src/config.ts`)

```typescript
export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  allowedOrigin: process.env.ALLOWED_ORIGIN || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: (process.env.NODE_ENV || "development") === "development",
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/lerna_demo",
};
```

### 4. Mongoose Connection (`packages/app/src/db.ts`)

```typescript
import mongoose from "mongoose";
import { logger } from "./logger";

export async function connectDB(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri);
    logger.info("✅ MongoDB connected");
  } catch (error) {
    logger.error("💥 MongoDB connection failed", { error });
    process.exit(1); // can't run without a database
  }
}

const userSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
});

export const UserModel = mongoose.model("User", userSchema);
```

### 5. Entry Point (`packages/app/src/index.ts`)

```typescript
import "dotenv/config"; // ✅ FIRST LINE — loads .env before config reads process.env
import { createApp } from "./app";
import { APP_NAME } from "@demo/common";
import { config } from "./config";
import { logger } from "./logger";
import { connectDB } from "./db";

const app = createApp();

// ✅ Wrap in async function — top-level await requires ESNext modules.
// CommonJS (the default) does not support it, so we use a main() wrapper.
// unhandledRejection below catches any error thrown inside main().
async function main() {
  await connectDB(config.mongoUri); // ✅ connect before accepting requests

  const server = app.listen(config.port, () => {
    logger.info(`🚀 Server running on http://localhost:${config.port}`);
    logger.info(`📦 Service: ${APP_NAME}`);
    logger.info(`🌍 Environment: ${config.nodeEnv}`);
  });

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

process.on("uncaughtException", (error) => {
  logger.error("💥 Uncaught Exception", { error });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("💥 Unhandled Promise Rejection", { reason });
  process.exit(1);
});

main();
export { app };
```

### 6. Seed Script (`packages/app/src/seed.ts`)

```typescript
import "dotenv/config"; // ✅ must be first — same reason as index.ts
import mongoose from "mongoose";
import { config } from "./config";
import { UserModel } from "./db";
import { logger } from "./logger";

async function seed() {
  await mongoose.connect(config.mongoUri);
  logger.info("✅ MongoDB connected");

  await UserModel.deleteMany({}); // clear existing to avoid duplicate key errors
  logger.info("🗑️  Cleared existing users");

  await UserModel.insertMany([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
  logger.info("🌱 Seeded 2 users");

  await mongoose.disconnect();
  logger.info("👋 Done");
}

seed().catch((error) => {
  logger.error("💥 Seed failed", { error });
  process.exit(1);
});
```

Add to `packages/app/package.json`:

```json
{
  "scripts": {
    "seed": "ts-node src/seed.ts"
  }
}
```

### 7. Narrowed `User.id` in `packages/common/src/index.ts`

Changed `id: number | string` to `id: number` to match the Mongoose schema.
This caused a downstream test failure that TypeScript caught at compile time —
the intended benefit of narrowing the type.

```typescript
export const APP_NAME = "Lerna Mono Demo (React 19)";

export interface User {
  id: number; // ✅ narrowed from number | string to match Mongoose schema
  name: string;
}

export const formatUser = (user: User): string => {
  return `User: ${user.name} (ID: ${user.id})`;
};
```

---

## 🧪 Updated Tests (`packages/app/src/app.test.ts`)

### Why Tests Were Failing After Adding MongoDB

After replacing the in-memory array with Mongoose, tests that hit
`/api/users` routes tried to make real MongoDB calls, but no database
runs in the test environment. This caused 10-second timeouts and failures.

### Fix — Mock `UserModel` with `jest.mock()`

```typescript
// ✅ Mock BEFORE any imports — jest.mock() is hoisted to the top automatically
jest.mock("./db", () => ({
  UserModel: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

import { UserModel } from "./db"; // gets the mocked version

// Control what the DB returns per test:
(UserModel.find as jest.Mock).mockResolvedValue([mockAlice, mockBob]); // success
(UserModel.findOne as jest.Mock).mockResolvedValue(null); // not found
(UserModel.create as jest.Mock).mockResolvedValue(newUser); // created
(UserModel.find as jest.Mock).mockRejectedValue(new Error("DB error")); // failure
```

`jest.clearAllMocks()` in `afterEach` resets call counts and return
values between tests so state never bleeds between test cases.

### New Tests Added

- `GET /api/users` → 500 when database throws
- `POST /api/users` → 201 creates new user
- `POST /api/users` → 409 when user already exists
- `POST /api/users` → 400 for missing fields

### Common Test Pitfalls Fixed

| Problem                                              | Fix                                                   |
| ---------------------------------------------------- | ----------------------------------------------------- |
| Tests timing out (10s)                               | Mock `UserModel` — no real DB calls                   |
| Flaky test detection by Nx                           | `app.listen(0)` + `server.close(done)` in `afterEach` |
| Mock state bleeding between tests                    | `jest.clearAllMocks()` in `afterEach`                 |
| `toEqual` failing when new fields added to `/health` | Use `toMatchObject` instead                           |

---

## ✅ Verification Steps

### Step 1 — Start MongoDB

```bash
docker compose up mongo -d
```

Expected:

```bash
✔ Container demo_mongo  Running
```

### Step 2 — Verify container is healthy

```bash
docker ps
```

Expected: `demo_mongo` status shows `(healthy)`

### Step 3 — Verify MongoDB is reachable

```bash
docker exec -it demo_mongo mongosh \
  "mongodb://admin:supersecretpassword@localhost:27017/lerna_demo?authSource=admin" \
  --eval "db.users.find()"
```

Expected: returns seeded documents (or empty array before seeding)

### Step 4 — Seed the database

```bash
npm run seed --workspace=packages/app
```

Expected logs:

```bash
✅ MongoDB connected
🗑️  Cleared existing users
🌱 Seeded 2 users
👋 Done
```

### Step 5 — Build and start the backend

```bash
# ✅ Always rebuild after TypeScript changes — dist/ is what runs
npm run build --workspace=packages/app
npm run start:app
```

Expected logs:

```bash
✅ MongoDB connected
🚀 Server running on http://localhost:4000
📦 Service: Lerna Mono Demo (React 19)
🌍 Environment: development
```

### Step 6 — Verify API

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/users
```

Expected `/health`:

```json
{
  "status": "ok",
  "service": "Lerna Mono Demo (React 19)",
  "uptime": 1.2,
  "timestamp": "2026-02-22T00:00:00.000Z"
}
```

Expected `/api/users`:

```json
[
  { "raw": { "id": 1, "name": "Alice" }, "formatted": "User: Alice (ID: 1)" },
  { "raw": { "id": 2, "name": "Bob" }, "formatted": "User: Bob (ID: 2)" }
]
```

### Step 7 — Start the frontend

```bash
npm run start:web
```

Open `http://localhost:3000` — should show Alice and Bob.

### Step 8 — Run all tests

```bash
npm run test:all
```

Expected:

```bash
✔ @demo/common:test
✔ @demo/app:test
2 passed (Playwright E2E)
```

---

## 🔴 Production To-Do List

### Critical

- [ ] **CI/CD pipeline** — add `.github/workflows/ci.yml` to run
      `test:unit` + `test:e2e` on every push and pull request
- [ ] **Production webpack build** — run `webpack --mode production`
      for minification and tree shaking (bundle size drops ~60-70%)
- [ ] **Containerize the app** — `packages/app/Dockerfile` +
      add `app` service to `docker-compose.yml` so the entire
      stack starts with a single `docker compose up`
- [ ] **Never commit `.env`** — verify `.gitignore` covers all
      `.env` variants; only `.env.example` should be committed

### Security

- [ ] **Rotate default credentials** — change `admin/supersecretpassword`
      to strong random values before any deployment
- [ ] **Hide MongoDB port in production** — remove `ports: 27017:27017`
      from `docker-compose.yml`; only the app container needs access
- [ ] **HTTPS** — put a reverse proxy (nginx, Caddy, or cloud LB)
      in front of the Node process; never serve plain HTTP in production

### Reliability

- [ ] **Process manager** — use PM2 or let Docker/Kubernetes handle
      automatic restarts when the process crashes
- [ ] **Mongoose connection retry** — add `serverSelectionTimeoutMS`
      to `mongoose.connect()` so transient network blips don't kill the process
- [ ] **Graceful MongoDB disconnect on shutdown** — call
      `mongoose.disconnect()` inside `shutdown()` before `process.exit()`

### Observability

- [ ] **Log shipping** — send Winston JSON logs to an aggregator
      (Datadog, AWS CloudWatch, Logtail, etc.)
- [ ] **Health check includes DB status** — update `/health` to check
      `mongoose.connection.readyState` so load balancers can detect
      a broken DB connection:

```typescript
app.get("/health", (_req, res) => {
  const dbState = mongoose.connection.readyState;
  // 0=disconnected 1=connected 2=connecting 3=disconnecting
  const dbStatus = dbState === 1 ? "ok" : "unavailable";
  const status = dbStatus === "ok" ? "ok" : "degraded";

  res.status(dbStatus === "ok" ? 200 : 503).json({
    status,
    service: APP_NAME,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: dbStatus,
  });
});
```

### Testing

- [ ] **Add seed step to E2E setup** — ensure Playwright tests always
      run against a known dataset by seeding before `test:e2e`
- [ ] **Consider `mongodb-memory-server`** — for true integration tests
      that exercise real Mongoose queries without requiring Docker

---

## 🗂️ Full Stack at a Glance

```bash
Browser (localhost:3000)
  └── React 19 + Redux 5 (webpack-dev-server)
        └── GET /api/users → POST /api/users
              └── Express 4 (localhost:4000)
                    ├── dotenv      (environment variables)
                    ├── helmet      (security headers)
                    ├── cors        (origin whitelist)
                    ├── express.json({ limit: "10kb" })
                    ├── morgan      (HTTP logging → Winston)
                    ├── rate-limit  (100 req / 15 min / IP)
                    └── Mongoose
                          └── MongoDB 8.2 (Docker container)
```

---

## 🚀 Daily Dev Workflow

```bash
# 1. Start MongoDB
docker compose up mongo -d

# 2. Seed if needed (first time, or to reset to known state)
npm run seed --workspace=packages/app

# 3. Build backend after any TypeScript changes
npm run build --workspace=packages/app

# 4. Start backend (terminal 1)
npm run start:app

# 5. Start frontend (terminal 2)
npm run start:web

# 6. Run all tests
npm run test:all
```

---

## 📁 Key Files Reference

| File                           | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| `docker-compose.yml`           | MongoDB 8.2 container + app service definition        |
| `packages/app/.env`            | Local secrets — never commit                          |
| `packages/app/.env.example`    | Template — always commit                              |
| `packages/app/src/config.ts`   | Centralised env var access incl. `mongoUri`           |
| `packages/app/src/db.ts`       | Mongoose `connectDB()` + `UserModel` schema           |
| `packages/app/src/seed.ts`     | Database seeder — run after first `docker compose up` |
| `packages/app/src/index.ts`    | Server entry point with `main()` async wrapper        |
| `packages/app/src/app.ts`      | Express app with Mongoose routes                      |
| `packages/app/src/app.test.ts` | Integration tests with mocked `UserModel`             |
| `packages/common/src/index.ts` | Shared `User` type — `id: number` (narrowed)          |
