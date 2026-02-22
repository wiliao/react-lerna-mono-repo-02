# Production Ready Guide

Based on everything in your project, here's what's needed grouped by priority:

---

## 🔴 Critical (Before Any Real Traffic)

**Environment variables** — secrets should never be hardcoded or committed to git:

```bash
# packages/app/.env.example (commit this)
PORT=4000
ALLOWED_ORIGIN=http://localhost:3000
NODE_ENV=development

# packages/app/.env (never commit — add to .gitignore)
PORT=4000
ALLOWED_ORIGIN=https://yourproductiondomain.com
NODE_ENV=production
```

Add `dotenv` to load them: `npm install dotenv` then `import "dotenv/config"` at the top of `index.ts`.

**Build step for the backend** — your app currently runs `node dist/index.js` which means TypeScript must be compiled first. Ensure your CI pipeline runs `tsc` before deploying, and that `dist/` is in `.gitignore`.

**`NODE_ENV=production` in deployment** — this single variable disables morgan's colored dev output, enables Winston's JSON format, and tells Express to optimize itself.

---

## 🟠 Important (Security & Reliability)

**Rate limiting** — without it, your API is trivially DoS-able:

```typescript
// app.ts
import rateLimit from "express-rate-limit";

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    message: { error: "Too many requests, please try again later" },
  }),
);
```

**Helmet** — sets secure HTTP headers in one line:

```typescript
import helmet from "helmet";
app.use(helmet()); // sets X-Content-Type-Options, HSTS, CSP, and more
```

**Input size limiting** — prevents large payload attacks:

```typescript
app.use(express.json({ limit: "10kb" })); // reject bodies over 10kb
```

**HTTPS** — never serve production traffic over plain HTTP. In practice this is handled by a reverse proxy (nginx, Caddy) or a cloud provider (AWS ALB, Cloudflare) sitting in front of your Node process rather than in Node itself.

---

## 🟡 Operational (Observability & Deployment)

**Health check improvements** — your current `/health` returns `{ status: "ok" }` which is good, but production health checks benefit from more signal:

```typescript
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: APP_NAME,
    uptime: process.uptime(), // seconds since process started
    timestamp: new Date().toISOString(),
  });
});
```

**Process manager** — Node processes crash. Use PM2 or let your container orchestrator (Docker + Kubernetes, Railway, Render) handle restarts. If running on a VPS directly: `npm install -g pm2` then `pm2 start dist/index.js`.

**Structured logging in production** — you already have Winston configured for JSON output in production, which is correct. The next step is shipping those logs somewhere: Datadog, AWS CloudWatch, Logtail, or similar.

**`/api/users` persistence** — your current `users` array lives in memory and resets on every server restart. For a real app this needs a database (PostgreSQL, MongoDB, etc.) with an ORM like Prisma or Drizzle.

---

## 🟢 Frontend (React/Redux)

**API base URL via environment variable** — the hardcoded `http://localhost:4000` in `actions.tsx` will break in production:

```typescript
// packages/web/.env
REACT_APP_API_URL=http://localhost:4000

// actions.tsx
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";
const response = await fetch(`${API_URL}/api/users`);
```

**Error boundary** — catches React render errors that Redux can't catch:

```typescript
// ErrorBoundary.tsx
import { Component, ReactNode } from "react";

class ErrorBoundary extends Component
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError
      ? <p>Something went wrong. Please refresh.</p>
      : this.props.children;
  }
}
```

Wrap `<App />` in `index.tsx` with `<ErrorBoundary>`.

**Production webpack build** — ensure `packages/web/package.json` has a `build` script: `webpack --mode production`. Production mode enables minification, tree shaking, and removes React's dev warnings — bundle size typically drops 60-70%.

---

## 🔵 CI/CD (Automation)

A minimal GitHub Actions pipeline that ties everything together:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build # compile TypeScript
      - run: npm run test:unit # lerna run test
      - run: npx playwright install --with-deps
      - run: npm run test:e2e # playwright
```

---

## Priority Order

```bash
1. Environment variables + .gitignore   ← security baseline
2. Helmet + rate limiting               ← security hardening
3. Database (replace in-memory array)   ← data persistence
4. API base URL from env in frontend    ← deployment correctness
5. CI/CD pipeline                       ← automation
6. Process manager / containerization   ← reliability
7. Structured log shipping              ← observability
8. Error boundary                       ← resilience
```

Your testing setup (unit + integration + E2E) is already production-grade — most projects reach production without that level of coverage. The biggest gap right now is the in-memory data store and the hardcoded API URL in the frontend.
