# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy monorepo root package files first (better layer caching)
COPY package*.json ./
COPY packages/common/package*.json ./packages/common/
COPY packages/app/package*.json ./packages/app/

RUN npm ci

# Copy source and build
COPY packages/common ./packages/common
COPY packages/app ./packages/app

RUN npm run build --workspace=packages/common
RUN npm run build --workspace=packages/app

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY packages/app/package*.json ./packages/app/
RUN npm ci --omit=dev --workspace=packages/app

# Copy only compiled output from builder
COPY --from=builder /app/packages/app/dist ./packages/app/dist
COPY --from=builder /app/packages/common/dist ./packages/common/dist

EXPOSE 4000
CMD ["node", "packages/app/dist/index.js"]
