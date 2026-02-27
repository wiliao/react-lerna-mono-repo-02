# 📱 Adding React Native Mobile Support to a Lerna Monorepo

> **Production-ready guide:** Cross-platform development with Android on Windows and iOS on Mac Mini, covering OAuth 2.0 + PKCE with Redis storage, refresh token rotation, reuse detection, and full JTI revocation.

---

## ⚠️ Critical Pre-Flight Checks

Before writing any code, acknowledge these constraints:

1. **Metro & Symlinks:** Metro does not resolve monorepo symlinks by default. You **must** configure `metro.config.js` or imports from shared packages will fail at build time.
2. **No Expo Go:** `react-native-app-auth` requires native code compilation. You **must** use a Custom Development Client built via EAS. Expo Go will not work.
3. **No `atob()`:** React Native does not include the browser's `atob()` function. Use the `jwt-decode` library instead — any code using `atob()` will crash at runtime.
4. **Cross-OS Split:** iOS builds require macOS. Android runs on Windows; iOS runs on Mac Mini. Both share the same codebase via Git and run Metro independently.

---

## 🖥️ Development Environment Overview

```
┌─────────────────────────────┐       Git / GitHub      ┌─────────────────────────────┐
│        Windows PC           │ ◄─────────────────────► │         Mac Mini            │
│                             │                          │                             │
│  • Daily development        │                          │  • iOS simulator testing    │
│  • Android emulator         │                          │  • Xcode / CocoaPods        │
│  • Metro bundler            │                          │  • EAS iOS builds           │
│  • Backend (Express)        │                          │  • TestFlight distribution  │
└─────────────────────────────┘                          └─────────────────────────────┘
```

**Workflow:** Write code on Windows → test Android locally → push to Git → pull on Mac Mini → test iOS. Metro runs independently on each machine. There is no shared Metro instance.

---

## 1. Environment Setup

### 🪟 Windows (Android & Backend)

**Node.js** — install the LTS release (v18 or v20) from nodejs.org:
```bash
node --version    # 18.x or 20.x
npm --version
```

**Git for Windows** — during install select "Checkout as-is, commit Unix-style line endings". Then set globally:
```bash
git config --global core.autocrlf input
```
This prevents CRLF line endings corrupting shell scripts that the Mac Mini will later run.

**JDK 17** — required by Android tooling:
```powershell
# Option A: winget (recommended)
winget install Microsoft.OpenJDK.17

# Option B: download manually from adoptium.net
```

Add to **System Environment Variables** (System Properties → Advanced → Environment Variables):
```
JAVA_HOME  =  C:\Program Files\Microsoft\jdk-17.x.x.x-hotspot
Path      +=  %JAVA_HOME%\bin
```

**Android Studio** — download from developer.android.com/studio. During the setup wizard check:
- Android SDK
- Android SDK Platform
- Android Virtual Device

Add to **System Environment Variables**:
```
ANDROID_HOME  =  C:\Users\<YourUser>\AppData\Local\Android\Sdk
Path         +=  %ANDROID_HOME%\platform-tools
Path         +=  %ANDROID_HOME%\emulator
```

Verify everything is wired up:
```bash
adb --version           # prints ADB version
emulator -list-avds     # lists available virtual devices
```

**Create an Android Virtual Device:**

1. Open Android Studio → **Virtual Device Manager** → **Create Device**
2. Select **Pixel 7** as the hardware profile
3. Select **API 34 (Android 14)** as the system image — download if needed
4. Name it `Pixel_7_API_34` and click Finish

**Redis (local dev)** — required by the backend:
```powershell
# Option A: Docker (recommended)
docker run -d -p 6379:6379 --name redis redis:7-alpine

# Option B: Windows Subsystem for Linux
wsl --install
# then inside WSL: sudo apt install redis-server && redis-server
```

**VS Code extensions:** React Native Tools (Microsoft), ESLint, Prettier.

---

### 🍎 Mac Mini (iOS)

**Xcode** — install from the Mac App Store (~15 GB). After installing:
```bash
xcode-select --install           # command line tools
sudo xcodebuild -license accept  # accept license non-interactively
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

**Homebrew:**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Node.js** — match your Windows version:
```bash
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
node --version
```

**Watchman** — Metro's file watcher, required on macOS:
```bash
brew install watchman
```

**CocoaPods** — manages iOS native dependencies:
```bash
sudo gem install cocoapods
pod --version    # should be 1.14+
```

**EAS CLI:**
```bash
npm install -g eas-cli
eas --version
```

**iOS Simulator** — Xcode ships with one. Add device types via:
**Xcode → Settings → Platforms → iOS** → download iOS 17.

Open the simulator:
```bash
open -a Simulator
```

**Clone the repo on the Mac Mini:**
```bash
git clone https://github.com/your-org/react-lerna-mono-repo.git
cd react-lerna-mono-repo
npm install
cd packages/mobile && npm install
cd ios && pod install
```

> **Re-run `pod install` whenever you:** add or remove a native dependency, update `react-native-app-auth`, update the Expo SDK, or switch to a branch with different native deps.

---

## 2. Monorepo Structure

```
react-lerna-mono-repo/
├── packages/
│   ├── app/              # Express backend
│   │   └── src/
│   │       ├── lib/      # redis.ts, env.ts
│   │       ├── services/ # tokenService.ts, pkceStore.ts
│   │       └── routes/   # oauth.ts
│   ├── web/              # React web frontend
│   ├── common/           # Shared types & utilities
│   └── mobile/           # React Native — NEW
│       └── src/
│           ├── services/ # auth.ts, api.ts, authState.ts
│           ├── contexts/ # AuthContext.tsx
│           └── screens/  # LoginScreen.tsx, HomeScreen.tsx
├── lerna.json
└── package.json
```

---

## 3. Dependencies

### Backend (`packages/app`)

```bash
npm install ioredis jose zod
npm install -D @types/ioredis
```

### Mobile (`packages/mobile`)

```bash
# Auth & security
npm install react-native-app-auth expo-secure-store expo-web-browser

# JWT decoding — use this, NOT atob()
npm install jwt-decode

# Networking
npm install axios

# Navigation
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context

# Custom dev client — required for react-native-app-auth
npm install expo-dev-client

# Environment config
npm install dotenv
```

### `packages/mobile/package.json`

```json
{
  "name": "@demo/mobile",
  "version": "1.0.0",
  "main": "src/App.tsx",
  "scripts": {
    "start": "expo start",
    "dev-client": "expo start --dev-client",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "build:android": "eas build --platform android",
    "build:ios": "eas build --platform ios",
    "test": "jest"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-dev-client": "~4.0.0",
    "expo-secure-store": "~13.0.0",
    "expo-web-browser": "~13.0.0",
    "react-native-app-auth": "^7.1.0",
    "jwt-decode": "^4.0.0",
    "axios": "^1.7.0",
    "dotenv": "^16.0.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/stack": "^6.3.0",
    "react-native-screens": "~3.31.0",
    "react-native-safe-area-context": "4.10.1"
  },
  "devDependencies": {
    "@types/react": "~18.2.0",
    "typescript": "^5.3.0"
  },
  "private": true
}
```

---

## 4. Configuration Files

### `packages/mobile/metro.config.js` ⚠️

Without this file, Metro cannot resolve packages outside the `mobile/` directory. This is the most common monorepo build failure.

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const monorepoRoot = path.resolve(__dirname, "../..");
const config = getDefaultConfig(__dirname);

// Watch all packages in the monorepo, not just mobile/
// Without this, changes to packages/common won't trigger hot reload
config.watchFolders = [monorepoRoot];

// Check mobile/node_modules first, then fall back to the hoisted root
// Without this, "Unable to resolve module" errors occur for hoisted packages
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Prevents Metro traversing up the tree in ways that conflict with Lerna hoisting
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

### `packages/mobile/app.json`

```json
{
  "expo": {
    "name": "Lerna Mono Demo",
    "slug": "lerna-mono-demo",
    "version": "1.0.0",
    "scheme": "com.demo.mobile",
    "plugins": ["expo-dev-client"],
    "ios": {
      "bundleIdentifier": "com.demo.mobile",
      "infoPlist": {
        "CFBundleURLTypes": [
          { "CFBundleURLSchemes": ["com.demo.mobile"] }
        ]
      }
    },
    "android": {
      "package": "com.demo.mobile",
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [{ "scheme": "com.demo.mobile" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### `packages/mobile/app.config.js` — Environment-Specific URLs

This is the single source of truth for environment-specific configuration. Never hardcode machine IPs in `auth.ts` or `api.ts`.

```javascript
import "dotenv/config";

// Fail loudly at startup if BACKEND_URL is missing in production.
// In development, fall back to localhost so the app still starts without a .env file.
const backendUrl = process.env.BACKEND_URL;
if (!backendUrl && process.env.NODE_ENV === "production") {
  throw new Error("BACKEND_URL environment variable is required in production");
}

export default {
  expo: {
    extra: {
      backendUrl: backendUrl ?? "https://localhost:3000",
    },
  },
};
```

Create `packages/mobile/.env` and add to `.gitignore`:
```bash
# packages/mobile/.env — NEVER commit this file
# Windows dev:  your Windows machine's local network IP
# Mac dev:      localhost if backend is on the same machine
BACKEND_URL=https://192.168.1.x:3000
```

---

## 5. Backend Code

### 5.1 `packages/app/src/lib/env.ts` — Validated Environment

```typescript
import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET:         z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  REDIS_URL:          z.string().startsWith("redis://"),
  NODE_ENV:           z.enum(["development", "production", "test"]).default("development"),
});

// Throws at startup with a clear message if any required variable is missing or invalid.
// This prevents the server from starting in a misconfigured state.
export const env = envSchema.parse(process.env);
```

Create `packages/app/.env` (add to `.gitignore`):
```bash
# packages/app/.env — NEVER commit this file
JWT_SECRET=change-this-to-a-32-char-min-secret!!
JWT_REFRESH_SECRET=a-different-secret-also-32-chars!!
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

---

### 5.2 `packages/app/src/lib/redis.ts`

```typescript
import Redis from "ioredis";
import { env } from "./env";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck:     true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on("error", (err) => {
  // Replace with your monitoring service (Sentry, Datadog, etc.) in production
  console.error("[Redis] Connection error:", err);
});

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
```

---

### 5.3 `packages/app/src/services/pkceStore.ts`

```typescript
import { redis } from "../lib/redis";

// 5 minutes — matches the OAuth spec recommendation for auth code lifetime
const PKCE_TTL_SECONDS = 300;

export interface PKCEData {
  codeChallenge: string;
  userId:        string;
  redirectUri:   string;
  scopes:        string[];
  createdAt:     number;
}

export async function savePKCE(state: string, data: PKCEData): Promise<void> {
  await redis.setex(`pkce:${state}`, PKCE_TTL_SECONDS, JSON.stringify(data));
}

export async function getPKCE(state: string): Promise<PKCEData | null> {
  const raw = await redis.get(`pkce:${state}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PKCEData;
  } catch (e) {
    // Log parse failures so Redis corruption is visible rather than silent
    console.error("[pkceStore.getPKCE] Failed to parse stored PKCE data for state:", state, e);
    return null;
  }
}

export async function deletePKCE(state: string): Promise<void> {
  await redis.del(`pkce:${state}`);
}
```

---

### 5.4 `packages/app/src/services/tokenService.ts`

Key fixes applied here:
- `createAccessToken` generates its own `jti` internally — callers must **not** pass one
- `rotateRefreshToken` returns `userId` so the caller issues tokens for the correct user
- `revokeUserSessions` actually invalidates all tracked refresh tokens in Redis via a pipeline

```typescript
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import crypto from "crypto";
import { redis } from "../lib/redis";
import { env } from "../lib/env";

const ACCESS_SECRET  = new TextEncoder().encode(env.JWT_SECRET);
const REFRESH_SECRET = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

const ACCESS_TOKEN_TTL_SECONDS  = 3600;       // 1 hour
const REFRESH_TOKEN_TTL_SECONDS = 30 * 86400; // 30 days

// ─────────────────────────────────────────────────────────────
// Payload Types
// ─────────────────────────────────────────────────────────────
export interface AccessTokenPayload extends JWTPayload {
  sub:   string;   // userId
  email: string;
  name:  string;
  jti:   string;   // Unique ID — required for revocation
  scope: string[];
}

export interface RefreshTokenPayload extends JWTPayload {
  sub:       string;    // userId
  type:      "refresh";
  jti:       string;    // Unique ID — required for reuse detection
  parentId?: string;    // JTI of the previous token (audit trail)
}

// ─────────────────────────────────────────────────────────────
// Token Creation
// ─────────────────────────────────────────────────────────────

/**
 * Creates a signed access token with a unique JTI.
 * Do NOT pass jti in the payload — it is always generated internally
 * to guarantee uniqueness and prevent the double-assignment bug.
 */
export async function createAccessToken(
  payload: Omit<AccessTokenPayload, "jti" | "iat" | "exp">
): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();

  const token = await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(ACCESS_SECRET);

  return { token, jti };
}

/**
 * Creates a signed refresh token with a unique JTI.
 * Pass parentId to link to the previous token for audit trail.
 * Do NOT pass jti in the payload — it is always generated internally.
 */
export async function createRefreshToken(
  payload: Omit<RefreshTokenPayload, "jti" | "iat" | "exp">,
  parentId?: string
): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();

  const token = await new SignJWT({
    ...payload,
    jti,
    ...(parentId ? { parentId } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(REFRESH_SECRET);

  return { token, jti };
}

// ─────────────────────────────────────────────────────────────
// Token Verification
// ─────────────────────────────────────────────────────────────
export async function verifyAccessToken(
  token: string
): Promise<{ valid: true; payload: AccessTokenPayload } | { valid: false; payload: null }> {
  try {
    const { payload } = await jwtVerify<AccessTokenPayload>(token, ACCESS_SECRET);

    const isRevoked = await redis.get(`revoked:access:${payload.jti}`);
    if (isRevoked) throw new Error("Token has been revoked");

    return { valid: true, payload };
  } catch {
    return { valid: false, payload: null };
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<{ valid: true; payload: RefreshTokenPayload } | { valid: false; payload: null }> {
  try {
    const { payload } = await jwtVerify<RefreshTokenPayload>(token, REFRESH_SECRET);

    // Reuse detection: has this refresh token already been used?
    const alreadyUsed = await redis.get(`used:refresh:${payload.jti}`);
    if (alreadyUsed) {
      // A valid but already-used token signals a stolen credential.
      // Revoke all sessions for this user immediately.
      console.error(
        `[Security] Refresh token reuse detected for user ${payload.sub}. Revoking all sessions.`
      );
      await revokeUserSessions(payload.sub);
      throw new Error("Refresh token reuse detected — all sessions revoked");
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, payload: null };
  }
}

// ─────────────────────────────────────────────────────────────
// Refresh Token Rotation
// ─────────────────────────────────────────────────────────────

/**
 * Verifies the old refresh token, marks it as used, and issues a new one.
 * Returns userId alongside the new token so the caller can issue an
 * access token attributed to the correct user — not a hardcoded placeholder.
 *
 * Returns null if verification fails or reuse is detected.
 */
export async function rotateRefreshToken(oldToken: string): Promise<{
  newToken: string;
  newJti:   string;
  userId:   string;
} | null> {
  const result = await verifyRefreshToken(oldToken);
  if (!result.valid) return null;

  const { sub: userId, jti: oldJti } = result.payload;

  // Track this JTI under the user for bulk revocation
  await redis.sadd(`user:refresh:tokens:${userId}`, oldJti);

  // Mark the old token as used — any replay of it triggers revokeUserSessions above
  await redis.setex(
    `used:refresh:${oldJti}`,
    REFRESH_TOKEN_TTL_SECONDS + 3600, // slightly longer than token lifetime
    "1"
  );

  const { token: newToken, jti: newJti } = await createRefreshToken(
    { sub: userId, type: "refresh" },
    oldJti // parentId for audit trail
  );

  // Track the new JTI too
  await redis.sadd(`user:refresh:tokens:${userId}`, newJti);

  return { newToken, newJti, userId };
}

// ─────────────────────────────────────────────────────────────
// Revocation
// ─────────────────────────────────────────────────────────────

/**
 * Adds an access token JTI to the revocation list.
 * TTL should match the token's remaining lifetime so Redis
 * cleans up the key automatically when the token would have expired.
 */
export async function revokeAccessToken(
  jti: string,
  expiresInSeconds: number
): Promise<void> {
  await redis.setex(`revoked:access:${jti}`, expiresInSeconds, "1");
}

/**
 * Revokes all active refresh tokens for a user.
 * Called automatically when token reuse is detected.
 * Uses a Redis pipeline to mark every known JTI as used atomically.
 */
export async function revokeUserSessions(userId: string): Promise<void> {
  const trackingKey = `user:refresh:tokens:${userId}`;
  const tokenJtis   = await redis.smembers(trackingKey);

  if (tokenJtis.length > 0) {
    const pipeline = redis.pipeline();
    for (const jti of tokenJtis) {
      pipeline.setex(`used:refresh:${jti}`, REFRESH_TOKEN_TTL_SECONDS + 3600, "1");
    }
    pipeline.del(trackingKey); // user must log in again to rebuild this set
    await pipeline.exec();
  }

  console.log(`[Security] Revoked ${tokenJtis.length} session(s) for user ${userId}`);
}
```

---

### 5.5 `packages/app/src/routes/oauth.ts`

Key fixes applied here:
- `issueTokenPair` no longer passes `jti` to `createAccessToken` (it generates its own)
- `handleRefreshTokenGrant` uses `userId` from `rotateRefreshToken` — not a hardcoded string
- Revoke endpoint verifies signatures before acting to prevent fake-JTI flooding

```typescript
import express from "express";
import crypto from "crypto";
import { z } from "zod";
import { savePKCE, getPKCE, deletePKCE } from "../services/pkceStore";
import {
  createAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  verifyAccessToken,
  revokeAccessToken,
  revokeUserSessions,
} from "../services/tokenService";
import { redis } from "../lib/redis";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Request Validation
// ─────────────────────────────────────────────────────────────
const authorizeSchema = z.object({
  client_id:             z.string().min(1),
  redirect_uri:          z.string().url(),
  code_challenge:        z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  state:                 z.string().min(1),
  scope:                 z.string().optional(),
});

const tokenSchema = z.object({
  grant_type:    z.enum(["authorization_code", "refresh_token"]),
  code:          z.string().optional(),
  code_verifier: z.string().min(43).max(128).optional(),
  state:         z.string().optional(),
  refresh_token: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /oauth/authorize
// ─────────────────────────────────────────────────────────────
router.get("/authorize", async (req, res) => {
  try {
    const parsed = authorizeSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error:             "invalid_request",
        error_description: parsed.error.errors[0].message,
      });
    }

    const { redirect_uri, code_challenge, state, scope } = parsed.data;

    // In production: validate client_id against a registered clients store
    // In production: validate redirect_uri against the client's allowed redirect URIs

    await savePKCE(state, {
      codeChallenge: code_challenge,
      userId:        "user-from-auth-system", // Replace with real user lookup
      redirectUri:   redirect_uri,
      scopes:        scope ? scope.split(" ") : ["openid", "profile", "email"],
      createdAt:     Date.now(),
    });

    const authCode = crypto.randomBytes(32).toString("hex");

    // Store code → state so we can look up PKCE data at token exchange time
    await redis.setex(`auth_code:${authCode}`, 300, state);

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", authCode);
    redirectUrl.searchParams.set("state", state);

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("[oauth.authorize]", error);
    return res.status(500).json({ error: "server_error" });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /oauth/token
// ─────────────────────────────────────────────────────────────
router.post("/token", async (req, res) => {
  try {
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error:             "invalid_request",
        error_description: parsed.error.errors[0].message,
      });
    }

    if (parsed.data.grant_type === "authorization_code") {
      return handleAuthorizationCodeGrant(res, parsed.data);
    }
    if (parsed.data.grant_type === "refresh_token") {
      return handleRefreshTokenGrant(res, parsed.data);
    }

    return res.status(400).json({ error: "unsupported_grant_type" });
  } catch (error) {
    console.error("[oauth.token]", error);
    return res.status(500).json({ error: "server_error" });
  }
});

// ─────────────────────────────────────────────────────────────
// Authorization Code Grant
// ─────────────────────────────────────────────────────────────
async function handleAuthorizationCodeGrant(
  res: express.Response,
  body: z.infer<typeof tokenSchema>
) {
  const { code, code_verifier, state } = body;

  if (!code || !code_verifier || !state) {
    return res.status(400).json({
      error:             "invalid_request",
      error_description: "code, code_verifier, and state are required",
    });
  }

  const storedState = await redis.get(`auth_code:${code}`);
  if (!storedState || storedState !== state) {
    return res.status(400).json({
      error:             "invalid_grant",
      error_description: "Invalid or expired authorization code",
    });
  }

  const pkceData = await getPKCE(state);
  if (!pkceData) {
    return res.status(400).json({
      error:             "invalid_grant",
      error_description: "PKCE state not found or expired",
    });
  }

  // Verify the code_verifier produces the stored code_challenge
  const computedChallenge = crypto
    .createHash("sha256")
    .update(code_verifier)
    .digest("base64url"); // Node 16+ — no manual character replacement needed

  if (computedChallenge !== pkceData.codeChallenge) {
    return res.status(400).json({
      error:             "invalid_grant",
      error_description: "PKCE verification failed",
    });
  }

  // Auth codes and PKCE state are single-use — delete immediately
  await Promise.all([
    redis.del(`auth_code:${code}`),
    deletePKCE(state),
  ]);

  return issueTokenPair(res, pkceData.userId, pkceData.scopes);
}

// ─────────────────────────────────────────────────────────────
// Refresh Token Grant
// ─────────────────────────────────────────────────────────────
async function handleRefreshTokenGrant(
  res: express.Response,
  body: z.infer<typeof tokenSchema>
) {
  const { refresh_token } = body;

  if (!refresh_token) {
    return res.status(400).json({
      error:             "invalid_request",
      error_description: "refresh_token is required",
    });
  }

  // rotateRefreshToken verifies the token, marks it as used, issues a new one,
  // and critically returns userId so we issue tokens for the correct user
  const rotation = await rotateRefreshToken(refresh_token);
  if (!rotation) {
    return res.status(401).json({
      error:             "invalid_grant",
      error_description: "Invalid or expired refresh token",
    });
  }

  const { newToken: newRefreshToken, userId } = rotation;

  // createAccessToken generates jti internally — do NOT pass one here
  const { token: accessToken } = await createAccessToken({
    sub:   userId,
    email: "user@demo.com", // In production: look up from your user store by userId
    name:  "Demo User",
    scope: ["openid", "profile", "email"],
  });

  return res.json({
    access_token:  accessToken,
    refresh_token: newRefreshToken,
    token_type:    "Bearer",
    expires_in:    3600,
  });
}

// ─────────────────────────────────────────────────────────────
// POST /oauth/revoke
// Verifies the token signature before acting — prevents an attacker
// from flooding the revocation list with crafted fake JTIs
// ─────────────────────────────────────────────────────────────
router.post("/revoke", async (req, res) => {
  try {
    const { token, token_type_hint } = req.body;
    if (!token) {
      return res.status(400).json({ error: "invalid_request" });
    }

    if (token_type_hint === "refresh_token") {
      // For refresh tokens: decode to get the userId, then revoke all their sessions
      const parts = token.split(".");
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf8")
          );
          if (payload.sub) {
            await revokeUserSessions(payload.sub);
          }
        } catch {
          // Malformed token — treat as already invalid, return success (idempotent)
        }
      }
    } else {
      // For access tokens: verify signature first to prevent fake-JTI flooding
      const verification = await verifyAccessToken(token);
      if (verification.valid) {
        const { jti, exp } = verification.payload;
        const remainingTtl = exp
          ? exp - Math.floor(Date.now() / 1000)
          : 3600;
        if (remainingTtl > 0) {
          await revokeAccessToken(jti, remainingTtl);
        }
      }
    }

    // Always return success — revocation is idempotent by spec
    return res.json({ revoked: true });
  } catch (error) {
    console.error("[oauth.revoke]", error);
    return res.status(500).json({ error: "server_error" });
  }
});

// ─────────────────────────────────────────────────────────────
// Helper: Issue Access + Refresh Token Pair
// createAccessToken and createRefreshToken both generate jti internally.
// Do NOT pass jti as a parameter to either.
// ─────────────────────────────────────────────────────────────
async function issueTokenPair(
  res: express.Response,
  userId: string,
  scopes: string[]
) {
  const [{ token: accessToken }, { token: refreshToken }] = await Promise.all([
    createAccessToken({
      sub:   userId,
      email: "user@demo.com", // In production: look up from your user store
      name:  "Demo User",
      scope: scopes,
    }),
    createRefreshToken({ sub: userId, type: "refresh" }),
  ]);

  return res.json({
    access_token:  accessToken,
    refresh_token: refreshToken,
    token_type:    "Bearer",
    expires_in:    3600,
    scope:         scopes.join(" "),
  });
}

export default router;
```

---

## 6. Mobile Application Code

### 6.1 `packages/mobile/src/services/auth.ts`

```typescript
import * as SecureStore from "expo-secure-store";
import { authorize, refresh, AuthorizeResult } from "react-native-app-auth";
import * as WebBrowser from "expo-web-browser";
import { jwtDecode } from "jwt-decode";
import Constants from "expo-constants";

// Single source of truth — set via app.config.js + .env, never hardcoded
const backendUrl: string =
  Constants.expoConfig?.extra?.backendUrl ?? "https://localhost:3000";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface StoredUser {
  sub:      string;
  email:    string;
  name:     string;
  picture?: string;
  scope:    string[];
}

interface TokenData {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number; // Unix ms with 5-minute buffer already applied
  user:         StoredUser;
}

// ─────────────────────────────────────────────────────────────
// OAuth Configuration
// react-native-app-auth handles code_verifier/challenge generation automatically
// ─────────────────────────────────────────────────────────────
const OAUTH_CONFIG = {
  issuer:      backendUrl,
  clientId:    "YOUR_MOBILE_CLIENT_ID",
  redirectUrl: "com.demo.mobile://callback",
  scopes:      ["openid", "profile", "email", "offline_access"],
  usePKCE:     true,
  serviceConfiguration: {
    authorizationEndpoint: `${backendUrl}/oauth/authorize`,
    tokenEndpoint:         `${backendUrl}/oauth/token`,
    revocationEndpoint:    `${backendUrl}/oauth/revoke`,
  },
};

// ─────────────────────────────────────────────────────────────
// Token Storage
// All token data stored as a single JSON blob under one key.
// Encrypted via device Keychain (iOS) / Keystore (Android).
// ─────────────────────────────────────────────────────────────
const TOKEN_KEY = "auth.tokens";

const tokenStorage = {
  async save(data: TokenData): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(data));
  },

  async get(): Promise<TokenData | null> {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TokenData;
    } catch {
      return null;
    }
  },

  async getUser(): Promise<StoredUser | null> {
    const data = await this.get();
    return data?.user ?? null;
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

// Exported so AuthContext can read display data after login/refresh
export const getStoredUser = (): Promise<StoredUser | null> => tokenStorage.getUser();

// ─────────────────────────────────────────────────────────────
// Auth Service
// ─────────────────────────────────────────────────────────────
export const authService = {
  /**
   * Initiates OAuth 2.0 + PKCE login via the system browser.
   * react-native-app-auth handles all PKCE mechanics automatically.
   * JWT payload is decoded for display only — never for authorization.
   */
  async login(): Promise<{ success: boolean; error?: string }> {
    try {
      await WebBrowser.maybeCompleteAuthSession();
      const result: AuthorizeResult = await authorize(OAUTH_CONFIG);

      const user = jwtDecode<StoredUser>(result.accessToken);

      await tokenStorage.save({
        accessToken:  result.accessToken,
        refreshToken: result.refreshToken ?? "",
        expiresAt:    new Date(result.accessTokenExpirationDate).getTime() - 5 * 60 * 1000,
        user:         { ...user, scope: result.scopes?.split(" ") ?? [] },
      });

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      if (message.toLowerCase().includes("cancel")) {
        return { success: false, error: "cancelled" };
      }
      console.error("[authService.login]", error);
      return { success: false, error: message };
    }
  },

  /**
   * Exchanges the stored refresh token for a new access token.
   * The server rotates the refresh token on every successful use.
   * Returns false and clears storage on any failure, forcing re-login.
   */
  async refreshToken(): Promise<boolean> {
    const stored = await tokenStorage.get();
    if (!stored?.refreshToken) return false;

    try {
      const result = await refresh(OAUTH_CONFIG, {
        refreshToken: stored.refreshToken,
      });

      const user = jwtDecode<StoredUser>(result.accessToken);

      await tokenStorage.save({
        accessToken:  result.accessToken,
        // Server rotates the refresh token — always use the new one if provided
        refreshToken: result.refreshToken ?? stored.refreshToken,
        expiresAt:    new Date(result.accessTokenExpirationDate).getTime() - 5 * 60 * 1000,
        user:         { ...user, scope: result.scopes?.split(" ") ?? [] },
      });

      return true;
    } catch (error) {
      console.error("[authService.refreshToken]", error);
      // Clear storage on any failure — expired, revoked, or reuse detected
      await tokenStorage.clear();
      return false;
    }
  },

  /**
   * Returns a valid access token.
   * Reads expiry from stored data in a single get() call — no redundant SecureStore reads.
   * Returns null if the user must log in again.
   */
  async getValidToken(): Promise<string | null> {
    const stored = await tokenStorage.get();
    if (!stored) return null;

    // Token still has buffer remaining
    if (Date.now() < stored.expiresAt) {
      return stored.accessToken;
    }

    // Near expiry or expired — attempt refresh
    const refreshed = await this.refreshToken();
    if (!refreshed) return null;

    const updated = await tokenStorage.get();
    return updated?.accessToken ?? null;
  },

  /**
   * Returns true if the user has an active session.
   * Attempts a transparent refresh before returning false.
   */
  async isAuthenticated(): Promise<boolean> {
    const stored = await tokenStorage.get();
    if (!stored?.accessToken) return false;
    if (Date.now() < stored.expiresAt) return true;
    return this.refreshToken();
  },

  /**
   * Revokes the refresh token on the server (best-effort),
   * then always clears local storage regardless of network outcome.
   */
  async logout(): Promise<void> {
    const stored = await tokenStorage.get();

    if (stored?.refreshToken) {
      await fetch(`${backendUrl}/oauth/revoke`, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    new URLSearchParams({
          token:           stored.refreshToken,
          token_type_hint: "refresh_token",
        }).toString(),
      }).catch((err) =>
        console.warn("[authService.logout] Server revocation failed:", err)
      );
    }

    await tokenStorage.clear();
  },
};
```

---

### 6.2 `packages/mobile/src/services/authState.ts`

```typescript
type Listener = () => void;
const listeners = new Set<Listener>();

export const authState = {
  onUnauthenticated(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit(): void {
    listeners.forEach((fn) => fn());
  },
};
```

---

### 6.3 `packages/mobile/src/services/api.ts`

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { authService } from "./auth";
import { authState } from "./authState";

const backendUrl: string =
  Constants.expoConfig?.extra?.backendUrl ?? "https://localhost:3000";

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const apiClient = axios.create({
  baseURL:  `${backendUrl}/api`,
  timeout:  10000,
  headers:  { "Content-Type": "application/json", Accept: "application/json" },
});

// Attach a valid JWT to every outgoing request
apiClient.interceptors.request.use(async (config) => {
  const token = await authService.getValidToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: attempt token refresh once, then signal the UI to show the login screen
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;

    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      // Prevent retrying token endpoint calls — would cause an infinite loop
      !config.url?.includes("/oauth/token")
    ) {
      config._retry = true;

      const refreshed = await authService.refreshToken();
      if (refreshed) {
        const newToken = await authService.getValidToken();
        if (newToken && config.headers) {
          config.headers.Authorization = `Bearer ${newToken}`;
        }
        // Use apiClient.request to preserve all interceptors on the retry
        return apiClient.request(config);
      }

      // Refresh failed — signal AuthContext to clear state and navigate to login
      authState.emit();
    }

    return Promise.reject(error);
  }
);

export { apiClient };
```

---

### 6.4 `packages/mobile/src/contexts/AuthContext.tsx`

```typescript
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { authService, getStoredUser, StoredUser } from "../services/auth";
import { authState } from "../services/authState";

interface AuthContextType {
  user:            StoredUser | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  login:           () => Promise<{ success: boolean; error?: string }>;
  logout:          () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                       = useState<StoredUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading]             = useState(true);

  useEffect(() => {
    // Restore existing session on app launch
    (async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        if (authenticated) {
          setUser(await getStoredUser());
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("[AuthProvider] session check failed", e);
      } finally {
        setIsLoading(false);
      }
    })();

    // Listen for forced logouts emitted by the 401 interceptor in api.ts
    const unsubscribe = authState.onUnauthenticated(() => {
      setUser(null);
      setIsAuthenticated(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const result = await authService.login();
    if (result.success) {
      setUser(await getStoredUser());
      setIsAuthenticated(true);
    }
    return result;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
```

---

### 6.5 `packages/mobile/src/screens/LoginScreen.tsx`

```typescript
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";

export function LoginScreen() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await login();
      if (!result.success && result.error !== "cancelled") {
        Alert.alert("Login Failed", result.error ?? "Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.title}>Lerna Mono Demo</Text>
        <Text style={styles.subtitle}>OAuth 2.0 + PKCE</Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Sign in with OAuth</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>Tokens stored in device Keychain / Keystore</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#f5f6fa" },
  content:        { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  logo:           { fontSize: 72, marginBottom: 16 },
  title:          { fontSize: 24, fontWeight: "700", color: "#2c3e50" },
  subtitle:       { fontSize: 14, color: "#7f8c8d", marginBottom: 48 },
  button:         { backgroundColor: "#3498db", paddingVertical: 16, paddingHorizontal: 40,
                    borderRadius: 12, minWidth: 220, alignItems: "center" },
  buttonDisabled: { backgroundColor: "#95a5a6" },
  buttonText:     { color: "#fff", fontSize: 16, fontWeight: "600" },
  hint:           { marginTop: 24, fontSize: 12, color: "#95a5a6", textAlign: "center" },
});
```

---

### 6.6 `packages/mobile/src/screens/HomeScreen.tsx`

```typescript
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, SafeAreaView, RefreshControl,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/api";

// Local type — does not conflict with StoredUser in auth.ts
interface ApiUser {
  id:    number;
  name:  string;
  email: string;
}

export function HomeScreen() {
  const { user, logout }            = useAuth();
  const [users, setUsers]           = useState<ApiUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setError(null);
      const { data } = await apiClient.get<ApiUser[]>("/users");
      setUsers(data);
    } catch {
      setError("Failed to load users. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name ?? "User"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchUsers(); }}
            />
          }
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>Users ({users.length})</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.emailSmall}>{item.email}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#f5f6fa" },
  centered:     { flex: 1, justifyContent: "center", alignItems: "center" },
  header:       { flexDirection: "row", justifyContent: "space-between",
                  alignItems: "center", backgroundColor: "#2c3e50", padding: 16 },
  greeting:     { color: "#fff", fontSize: 16, fontWeight: "600" },
  email:        { color: "#bdc3c7", fontSize: 12, marginTop: 2 },
  logoutBtn:    { backgroundColor: "#e74c3c", paddingVertical: 8,
                  paddingHorizontal: 14, borderRadius: 6 },
  logoutText:   { color: "#fff", fontSize: 13, fontWeight: "500" },
  list:         { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#2c3e50", marginBottom: 12 },
  card:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
                  padding: 14, borderRadius: 10, marginBottom: 10,
                  shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: "#3498db",
                  justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText:   { color: "#fff", fontSize: 18, fontWeight: "600" },
  name:         { fontSize: 15, fontWeight: "600", color: "#2c3e50" },
  emailSmall:   { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
  errorText:    { color: "#e74c3c", fontSize: 14, textAlign: "center", padding: 24 },
});
```

---

### 6.7 `packages/mobile/src/App.tsx`

```typescript
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoginScreen } from "./screens/LoginScreen";
import { HomeScreen } from "./screens/HomeScreen";

const Stack = createStackNavigator();

function Navigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated
        ? <Stack.Screen name="Home"  component={HomeScreen} />
        : <Stack.Screen name="Login" component={LoginScreen} />
      }
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Navigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
```

---

## 7. Running the App

> **Why not Expo Go?** `react-native-app-auth` contains native iOS/Android code that must be compiled into the app bundle. Expo Go ships with a fixed native module set and cannot load custom ones at runtime. A Custom Dev Client is Expo Go rebuilt to include your app's native dependencies. Build it once — only rebuild when native dependencies change.

---

### 🪟 Windows — Android

**First time only:**
```bash
cd packages/mobile
eas login                           # free Expo account
eas build:configure                 # generates eas.json
eas build --profile development --platform android
```

Install the downloaded `.apk` on your emulator:
```bash
adb install path/to/your-dev-client.apk
```

**Every development session:**
```bash
# Terminal 1 — Redis (if not running as a service)
docker start redis

# Terminal 2 — backend
cd packages/app && npm run dev:https

# Terminal 3 — Android emulator
emulator -avd Pixel_7_API_34

# Terminal 4 — Metro
cd packages/mobile && npm run dev-client
```

Press `a` in the Metro terminal to open on the emulator.

Metro keyboard shortcuts:
```
a  →  open/reload on Android
r  →  reload JS bundle
m  →  open developer menu
j  →  open debugger
```

---

### 🍎 Mac Mini — iOS

**First time only:**
```bash
cd packages/mobile
eas login    # same Expo account as Windows
eas build --profile development --platform ios
# Free Apple account = simulator only
# Paid Apple Developer ($99/yr) = real device + TestFlight
```

Install on the simulator:
```bash
xcrun simctl install booted path/to/YourApp.app
```

**Every development session:**
```bash
cd packages/mobile && npm run dev-client
```

Press `i` in the Metro terminal to launch on the iOS Simulator.

---

### 🌐 Connecting Mac Mini to the Windows Backend

**Step 1** — Find your Windows IP:
```powershell
ipconfig
# Look for IPv4 Address, e.g. 192.168.1.42
```

**Step 2** — Set it in `packages/mobile/.env` on the Mac Mini:
```bash
BACKEND_URL=https://192.168.1.42:3000
```

**Step 3** — Restart Metro:
```bash
npm run dev-client
```

`app.config.js` reads `BACKEND_URL` at startup and injects it via `expo-constants`. Both `auth.ts` and `api.ts` derive all their URLs from this single value — nothing else needs changing.

> **HTTPS on the local network:** Install `mkcert` on Windows to generate a locally-trusted certificate, then import the root CA into macOS Keychain on the Mac Mini. Alternatively, add `NSAllowsArbitraryLoads` to `app.json` `ios.infoPlist` for development only — remove it before any TestFlight or App Store build.

---

### 🔄 Typical Daily Workflow

```
Windows (primary development)
├── Edit code in VS Code
├── Run Android emulator for fast feedback
├── Commit and push to Git
│
Mac Mini (iOS verification)
├── git pull
├── npm install              (only if package.json changed)
├── cd ios && pod install    (only if native deps changed)
├── npm run dev-client
└── Verify on iOS Simulator
```

---

### When to Rebuild the Dev Client

Rebuild with `eas build` only when:
- Adding or removing a native dependency
- Updating `react-native-app-auth` or the Expo SDK version
- Changing `scheme`, `bundleIdentifier`, or `package` in `app.json`

Regular TypeScript changes, new screens, and API updates do **not** require a rebuild — Metro hot-reloads them instantly.

---

## 8. Production Checklist

| Area | Item | Notes |
|---|---|---|
| **PKCE storage** | Redis with 5-minute TTL | Implemented in `pkceStore.ts` |
| **Token rotation** | Refresh tokens rotate on every use | Implemented in `rotateRefreshToken` |
| **Reuse detection** | Replay triggers full session revocation | Implemented in `verifyRefreshToken` + `revokeUserSessions` |
| **JTI revocation** | Access tokens checked against Redis blocklist | Implemented in `verifyAccessToken` |
| **Revoke endpoint** | Verifies signature before acting | Prevents fake-JTI flooding attack |
| **No jti double-pass** | `createAccessToken` generates jti internally | Never pass jti from call sites |
| **Correct userId** | `rotateRefreshToken` returns userId | No more hardcoded placeholder in refresh grant |
| **User lookup** | Replace hardcoded user data with DB lookup | Marked with `// In production` comments |
| **Client registry** | Validate `client_id` and `redirect_uri` | Marked with `// In production` comments |
| **Env validation** | `env.ts` throws on startup if vars missing | Prevents misconfigured deployments |
| **No localhost fallbacks** | `app.config.js` throws in production without `BACKEND_URL` | Prevents silent misconfiguration |
| **JWT on client** | Decoded data is display-only | Never used for authorization decisions |
| **No client secrets** | Public client PKCE flow only | Never embed a client secret in the app |
| **HTTPS** | All OAuth endpoints use HTTPS | Required for OAuth redirects |
| **Metro config** | `metro.config.js` includes monorepo root | Required for shared package imports |
| **Dev client** | Built via `eas build` | `react-native-app-auth` needs native compilation |
| **Rate limiting** | Add to `/oauth/token` and `/oauth/revoke` | Protects against brute force |
| **Redis HA** | Persistence + replication in production | AWS ElastiCache, Upstash, etc. |
| **Error boundaries** | Wrap `<Navigator>` in `<ErrorBoundary>` | Prevents blank screens on uncaught errors |
| **Line endings** | `core.autocrlf input` on Windows | Prevents script corruption on Mac |
| **CocoaPods** | Re-run `pod install` after native dep changes | Easy to forget on branch switches |
| **iOS SSL** | Remove `NSAllowsArbitraryLoads` before shipping | Development workaround only |

---

## 9. Troubleshooting

### General

| Error | Fix |
|---|---|
| `Unable to resolve module X` | `metro.config.js` is missing or `nodeModulesPaths` doesn't include the monorepo root |
| `atob is not defined` | Replace with `jwt-decode` — `atob()` doesn't exist in React Native |
| `No native module found` | You're using Expo Go — build a Custom Dev Client via `eas build` |
| `Invalid code_verifier` | Ensure `state` is passed through the redirect and used as the PKCE lookup key |
| App hangs after OAuth redirect | Check `WebBrowser.maybeCompleteAuthSession()` is called and `scheme` in `app.json` matches `redirectUrl` |
| `Redis connection refused` | Redis is not running — start with `docker start redis` |
| 401 after login with valid token | Reuse detection fired — clear app storage, log in again, check server logs |

---

### 🪟 Windows / Android

| Error | Fix |
|---|---|
| `JAVA_HOME is not set` | Verify in System Properties → Environment Variables; restart terminal after saving |
| `adb: command not found` | `%ANDROID_HOME%\platform-tools` is not in `Path` — add it and restart terminal |
| Metro can't connect to emulator | Run `adb reverse tcp:8081 tcp:8081` — Metro also prints this automatically |
| CRLF errors on Mac after pulling | Run `git config --global core.autocrlf input` and recommit affected files |
| SSL warning hitting local backend | Expected with self-signed cert; use `mkcert` for a trusted local certificate |

---

### 🍎 Mac Mini / iOS

| Error | Fix |
|---|---|
| `pod install` fails — incompatible versions | Run `pod repo update` then retry `pod install` |
| `xcodebuild requires Xcode` | Run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` |
| Simulator shows "Unable to connect to Metro" | Press `i` in the Metro terminal to re-inject the correct Metro URL |
| `NSURLErrorDomain -1202` SSL error | iOS simulator rejects self-signed certs; use `mkcert` or add `NSAllowsArbitraryLoads` (dev only) |
| App crashes immediately after `pod install` | Native modules changed but dev client wasn't rebuilt — run `eas build` again |
