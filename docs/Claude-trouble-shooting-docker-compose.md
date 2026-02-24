Here's the full troubleshooting journey from start to finish:

---

**Problem 1: `husky: not found`**
The `prepare` script ran husky during `npm ci --omit=dev`, but husky is a devDependency and wasn't installed.
**Fix:** Added `--ignore-scripts` to skip all lifecycle scripts during `npm ci`.

---

**Problem 2: `Cannot read file '/app/tsconfig.json'`**
The root `tsconfig.json` wasn't copied into the Docker build context, so TypeScript couldn't compile.
**Fix:** Added `COPY tsconfig.json ./` in the builder stage.

---

**Problem 3: `Cannot find module 'express-rate-limit'`**
The production stage ran `npm ci --workspace=packages/app` which only installed app-level dependencies, missing root-level hoisted packages like `express-rate-limit`.
**Fix:** Replaced `npm ci` in the production stage with `COPY --from=builder /app/node_modules ./node_modules` to reuse the already-resolved node_modules from the builder.

---

**Problem 4: `Cannot find module '@demo/common'`**
Workspace symlinks (e.g. `node_modules/@demo/common → packages/common`) are not preserved when using `COPY` between Docker stages.
**Fix:** Manually recreated the symlink in the production stage:

```dockerfile
RUN mkdir -p node_modules/@demo && \
    ln -sf /app/packages/common node_modules/@demo/common
```

---

**Problem 5: MongoDB connection failed (no credentials)**
The `.env` file didn't exist, so `MONGO_USER`, `MONGO_PASSWORD`, and `MONGO_DB` were all blank.
**Fix:** Created a `.env` file with the MongoDB credentials.

---

**Problem 6: `AuthenticationFailed`**
The `mongo_data` volume had been initialized previously without credentials, so the new credentials didn't match.
**Fix:** Ran `docker-compose down -v` to wipe the volume and let MongoDB reinitialize with the correct credentials.

---

After all six fixes the server came up healthy with MongoDB connected. ✅

All 4 tests passing! 🎉

The full journey from start to finish:

**Docker fixes:**

1. `--ignore-scripts` — bypassed husky during `npm ci`
2. `COPY tsconfig.json ./` — provided root TypeScript config to builder
3. Copied `node_modules` from builder — preserved hoisted root dependencies
4. Recreated `@demo/common` symlink — workspace symlinks don't survive `COPY`
5. Created `.env` — provided MongoDB credentials
6. `docker-compose down -v` — wiped stale volume for clean MongoDB init

**E2E test fixes:** 7. Copied `.env` to `packages/app/` — so `dotenv` could find credentials when seed runs from that directory 8. Fixed `"👤 admin"` → `"admin"` — matched the actual DOM output in the header

Yes, you still need the root `.env` for:

1. **`docker-compose up`** — it reads `MONGO_USER`, `MONGO_PASSWORD`, and `MONGO_DB` from the root `.env` to configure both the MongoDB container and the app container's `MONGO_URI`
2. **`npm run test:e2e`** — Playwright's `webServer` starts `npm run start:app` (backend) which needs `MONGO_URI`, `PORT`, etc.

The `packages/app/.env` is only needed for the seed script since it runs with `packages/app` as the working directory. Both files are needed.
