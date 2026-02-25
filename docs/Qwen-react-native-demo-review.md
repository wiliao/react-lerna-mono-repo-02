# 📝 Guide Review: React Native Mobile App with OAuth 2.0 + PKCE + JWT

This is an **excellent, comprehensive guide** with production-ready patterns! Below is a detailed review with critical fixes, improvements, and monorepo-specific enhancements.

---

## ✅ What's Done Well

| Area                | Strength                                                        |
| ------------------- | --------------------------------------------------------------- |
| 🔐 Security         | PKCE flow, SecureStore usage, token rotation, HTTPS enforcement |
| 🏗️ Architecture     | Clear separation: services, contexts, screens, navigation       |
| ♻️ Token Management | Auto-refresh on 401, expiry buffering, secure storage           |
| 🧭 UX               | Loading states, error handling, refresh controls                |
| 📦 Expo Choice      | Smart decision for faster monorepo integration                  |

---

## 🚨 Critical Fixes Needed

### 1. **PKCE Backend Logic Bug** (`oauth.ts`)

```typescript
// ❌ BUG: Using `code` as map key, but `state` was stored
const storedCode = pkceCodes.get(code); // WRONG

// ✅ FIX: Use `state` parameter as the key
const storedData = pkceCodes.get(state);
if (!storedData || storedData.challenge !== expectedChallenge) {
  return res.status(400).json({ error: "Invalid PKCE verification" });
}
```

**Also**: The authorization code itself needs to be stored/validated separately from the PKCE challenge. Current implementation conflates the two.

### 2. **Token Expiry Calculation Error** (`auth.ts`)

```typescript
// ❌ BUG: Adding Date.now() to an absolute timestamp
const expiresAt =
  Date.now() +
  (result.accessTokenExpirationDate
    ? new Date(result.accessTokenExpirationDate).getTime() - 300000 // ← Absolute time!
    : Date.now() + 3600000);

// ✅ FIX: Use absolute time directly with buffer
const expiresAt = result.accessTokenExpirationDate
  ? new Date(result.accessTokenExpirationDate).getTime() - 300000
  : Date.now() + 3600000;
```

### 3. **Expo Router vs React Navigation Conflict**

```json
// package.json shows:
"main": "expo-router/entry",  // ← Expo Router

// But App.tsx uses:
import { createStackNavigator } from '@react-navigation/stack';  // ← React Navigation
```

**Choose one**:

- **Option A**: Stick with React Navigation (remove `expo-router/entry`, use `index.js` entry)
- **Option B**: Migrate to Expo Router (file-based routing, better for monorepos)

---

## 🔧 Monorepo-Specific Improvements

### A. Root Workspace Configuration

```json
// root/package.json
{
  "workspaces": [
    "packages/app",
    "packages/web",
    "packages/common",
    "packages/mobile" // ← Add this
  ],
  "scripts": {
    "start:mobile": "lerna run start --scope=@demo/mobile",
    "start:all": "lerna run start --parallel"
  }
}
```

### B. Share Types via `@demo/common`

```typescript
// packages/common/src/types/auth.ts
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}
```

```typescript
// packages/mobile/src/services/auth.ts
import { AuthTokens, UserProfile } from "@demo/common";
// Now types stay in sync across web/mobile/backend!
```

### C. Environment Configuration

```javascript
// packages/mobile/app.config.js (dynamic config)
module.exports = ({ config }) => {
  const env = process.env.APP_ENV || "development";
  return {
    ...config,
    name: `Lerna Demo (${env})`,
    extra: {
      apiUrl:
        process.env.API_URL ||
        {
          development: "http://localhost:3000",
          production: "https://your-backend.com",
        }[env],
      oauth: {
        clientId: process.env.OAUTH_CLIENT_ID,
        redirectUrl: process.env.REDIRECT_URL || "com.demo.mobile://callback",
      },
    },
  };
};
```

---

## 🛡️ Security Enhancements

### 1. Validate `redirect_uri` on Backend

```typescript
// packages/app/src/routes/oauth.ts
const ALLOWED_REDIRECT_URIS = {
  YOUR_MOBILE_CLIENT_ID: ["com.demo.mobile://callback"],
};

router.get("/oauth/authorize", (req, res) => {
  const { client_id, redirect_uri } = req.query;

  if (!ALLOWED_REDIRECT_URIS[client_id]?.includes(redirect_uri)) {
    return res.status(400).json({ error: "Invalid redirect_uri" });
  }
  // ... rest of logic
});
```

### 2. Add JWT Decoding Warning

```typescript
// auth.ts - decodeJWT function
/**
 * ⚠️ WARNING: Client-side JWT decoding is for UI display ONLY.
 * NEVER use decoded claims for authorization decisions.
 * Always validate tokens on the backend.
 */
```

### 3. Handle Token Refresh Race Conditions

```typescript
// api.ts - Prevent multiple simultaneous refresh attempts
let refreshPromise: Promise<boolean> | null = null;

async function getValidTokenWithRefresh(): Promise<string | null> {
  if (await tokenStorage.isTokenExpired()) {
    if (!refreshPromise) {
      refreshPromise = authService.refreshTokens().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (!refreshed) return null;
  }
  return await tokenStorage.getAccessToken();
}
```

---

## 🧹 Code Quality Suggestions

### 1. Replace Custom EventEmitter

```typescript
// Use a proper solution:
import { EventEmitter } from "events"; // Node.js
// OR
import EventEmitter from "react-native-event-emitter";
// OR better: use React context callbacks for auth state changes
```

### 2. Stronger TypeScript Types

```typescript
// Instead of `any` for JWT payload:
interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  exp?: number;
  iat?: number;
}

const decodeJWT = (token: string): JWTPayload | null => { ... }
```

### 3. Extract Config to Constants File

```typescript
// packages/mobile/src/config/oauth.ts
export const OAUTH_CONFIG = {
  development: {
    /* ... */
  },
  production: {
    /* ... */
  },
} as const;
```

---

## 🧪 Testing Recommendations

Add to your guide:

```bash
# packages/mobile/package.json
{
  "scripts": {
    "test": "jest",
    "test:e2e": "maestro test .maestro/"
  },
  "devDependencies": {
    "@testing-library/react-native": "^12.0.0",
    "jest-expo": "~50.0.0",
    "maestro-cli": "^0.24.0"  // For E2E flow tests
  }
}
```

**Critical test cases**:

- [ ] Token refresh flow on 401
- [ ] PKCE authorization roundtrip
- [ ] SecureStore persistence after app restart
- [ ] Deep link callback handling

---

## 📋 Final Checklist Additions

| Task                            | Status         | Notes                               |
| ------------------------------- | -------------- | ----------------------------------- |
| Workspace config in root        | ⚠️ Missing     | Add `packages/mobile` to workspaces |
| Shared types via `@demo/common` | ⚠️ Missing     | Prevents type drift                 |
| PKCE `state` vs `code` fix      | 🔴 Critical    | Security vulnerability if unfixed   |
| Token expiry calculation        | 🔴 Critical    | Causes premature logouts            |
| Redirect URI validation         | 🔴 Critical    | Open redirect risk                  |
| Environment config management   | ⚠️ Recommended | Use `app.config.js`                 |
| E2E testing setup               | ⚠️ Recommended | Maestro/Detox for auth flows        |

---

## 🎯 One-Line Summary

> **Fix the PKCE `state`/`code` bug and token expiry math first**—these are security/functionality critical. Then enhance monorepo integration via shared types and workspace config.

---

## 💡 Bonus: Quick Start Script for Contributors

Add to root `README.md`:

```bash
# 🚀 One-time setup
npm install -g lerna expo-cli
npm install  # installs all workspace packages

# 🔐 Configure environment
cd packages/mobile
cp .env.example .env
# Edit .env with your OAuth client details

# 📱 Run everything
npm run start:all  # Starts backend + web + mobile concurrently

# 🧪 Test auth flow
npm run test:e2e  # Runs Maestro auth flow tests
```

---

Your guide is **90% production-ready**—with these fixes, it'll be a gold-standard reference for secure React Native + OAuth monorepo setups! 🎉

Need help implementing any of these fixes? I can provide patched code snippets. 😊
