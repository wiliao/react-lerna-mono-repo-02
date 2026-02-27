# 📱 Adding React Native Mobile Support to a Lerna Monorepo

> **Production-Ready Guide:** Cross-platform development (Android on Windows, iOS on Mac) with OAuth2/OIDC, PKCE, and secure token storage.

---

## ⚠️ Critical Pre-Flight Checks

Before starting, acknowledge these four constraints specific to React Native in a monorepo:

1.  **Metro Bundler & Symlinks:** Metro does not resolve monorepo symlinks by default. **You must configure `metro.config.js`** or imports from shared packages (e.g., `@repo/common`) will fail.
2.  **No Expo Go:** Libraries like `react-native-app-auth` require native code. You **must** use a **Custom Development Client** built via EAS. Expo Go will not work.
3.  **No `atob()`:** React Native does not support the browser's `atob()` function. Use `jwt-decode` for JWT parsing.
4.  **Cross-OS Workflow:**
    - **Windows:** Daily coding, Android emulation, Backend development.
    - **Mac Mini:** iOS simulation, iOS builds, TestFlight distribution.
    - **Sync:** Both machines share the codebase via Git. Metro runs independently on each.

---

## 1. Environment Setup

### 🪟 Windows (Android & Backend)

1.  **Node.js:** Install LTS (v18 or v20). Verify with `node --version`.
2.  **Git:** Install with "Checkout as-is, commit Unix-style line endings" to prevent script corruption on Mac.
    ```bash
    git config --global core.autocrlf input
    ```
3.  **JDK 17:** Required for Android. Set `JAVA_HOME` and add `%JAVA_HOME%\bin` to Path.
4.  **Android Studio:** Install SDK, Platform Tools, and Emulator. Set `ANDROID_HOME`.
5.  **VS Code Extensions:** React Native Tools, ESLint, Prettier.

### 🍎 Mac Mini (iOS)

1.  **Xcode:** Install from App Store. Run `sudo xcodebuild -license accept`.
2.  **Homebrew:** Install package manager.
3.  **Node.js:** Match Windows version (e.g., `brew install node@20`).
4.  **CocoaPods:** Required for iOS native deps (`sudo gem install cocoapods`).
5.  **Watchman:** File watcher for Metro (`brew install watchman`).
6.  **EAS CLI:** Expo build tool (`npm install -g eas-cli`).

---

## 2. Monorepo Structure & Integration

### Directory Layout

```text
react-lerna-mono-repo/
├── packages/
│   ├── app/              # Express Backend
│   ├── web/              # React Web Frontend
│   ├── common/           # Shared Types/Utils
│   └── mobile/           # React Native (Expo)
├── lerna.json
└── package.json
```

### Step 2.1: Initialize Mobile Package

```bash
cd packages
npx create-expo-app mobile --template blank-typescript
cd mobile
```

### Step 2.2: Install Dependencies

```bash
# Auth & Security
npm install react-native-app-auth expo-secure-store expo-web-browser jwt-decode
# Networking
npm install axios
# Navigation
npm install @react-navigation/native @react-navigation/stack react-native-screens react-native-safe-area-context
# Dev Client (Required for native modules)
npm install expo-dev-client
```

### Step 2.3: Configure Metro for Monorepo ⚠️

**File:** `packages/mobile/metro.config.js`  
_Without this, you cannot import from `packages/common`._

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const monorepoRoot = path.resolve(__dirname, "../..");
const config = getDefaultConfig(__dirname);

// 1. Watch all packages in the monorepo
config.watchFolders = [monorepoRoot];

// 2. Resolve node_modules from mobile first, then root
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Disable hierarchical lookup to respect Lerna hoisting
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

### Step 2.4: Configure Deep Linking

**File:** `packages/mobile/app.json`  
_Required for OAuth redirects._

```json
{
  "expo": {
    "scheme": "com.demo.mobile",
    "ios": {
      "bundleIdentifier": "com.demo.mobile",
      "infoPlist": {
        "CFBundleURLTypes": [{ "CFBundleURLSchemes": ["com.demo.mobile"] }]
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

---

## 3. Mobile Application Code

### 3.1 Authentication Service

**File:** `packages/mobile/src/services/auth.ts`  
_Handles OAuth flow, PKCE, and Secure Storage._

```typescript
import * as SecureStore from "expo-secure-store";
import { authorize, refresh, AuthorizeResult } from "react-native-app-auth";
import * as WebBrowser from "expo-web-browser";
import { jwtDecode } from "jwt-decode";

// ⚠️ Update URLs to match your backend
const OAUTH_CONFIG = {
  issuer: "https://your-backend.com",
  clientId: "YOUR_MOBILE_CLIENT_ID",
  redirectUrl: "com.demo.mobile://callback",
  scopes: ["openid", "profile", "email"],
  usePKCE: true,
  serviceConfiguration: {
    authorizationEndpoint: "https://your-backend.com/oauth/authorize",
    tokenEndpoint: "https://your-backend.com/oauth/token",
    revocationEndpoint: "https://your-backend.com/oauth/revoke",
  },
};

const KEYS = {
  ACCESS_TOKEN: "auth.access_token",
  REFRESH_TOKEN: "auth.refresh_token",
  TOKEN_EXPIRY: "auth.token_expiry",
  USER_DATA: "auth.user_data",
};

export const tokenStorage = {
  async save({ accessToken, refreshToken, expiresAt, user }: any) {
    // Subtract 5 minutes buffer to ensure we refresh before expiry
    const expiryMs = new Date(expiresAt).getTime() - 5 * 60 * 1000;
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
      SecureStore.setItemAsync(KEYS.TOKEN_EXPIRY, String(expiryMs)),
      SecureStore.setItemAsync(KEYS.USER_DATA, JSON.stringify(user)),
    ]);
  },
  async getAccessToken() {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },
  async isExpired() {
    const expiry = await SecureStore.getItemAsync(KEYS.TOKEN_EXPIRY);
    return !expiry || Date.now() >= parseInt(expiry, 10);
  },
  async getUser() {
    const raw = await SecureStore.getItemAsync(KEYS.USER_DATA);
    return raw ? JSON.parse(raw) : null;
  },
  async clear() {
    await Promise.all(
      Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)),
    );
  },
};

export const authService = {
  async login() {
    try {
      await WebBrowser.maybeCompleteAuthSession();
      const result: AuthorizeResult = await authorize(OAUTH_CONFIG);
      const user = jwtDecode(result.accessToken);
      await tokenStorage.save({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? "",
        expiresAt: result.accessTokenExpirationDate,
        user,
      });
      return { success: true };
    } catch (error: any) {
      if (error.message?.includes("cancelled"))
        return { success: false, error: "cancelled" };
      return { success: false, error: error.message };
    }
  },
  async refreshToken() {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const result = await refresh(OAUTH_CONFIG, { refreshToken });
      const user = jwtDecode(result.accessToken);
      await tokenStorage.save({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? refreshToken,
        expiresAt: result.accessTokenExpirationDate,
        user,
      });
      return true;
    } catch {
      await tokenStorage.clear();
      return false;
    }
  },
  async getValidToken() {
    if (await tokenStorage.isExpired()) {
      if (!(await this.refreshToken())) return null;
    }
    return tokenStorage.getAccessToken();
  },
  async logout(revokeEndpoint: string) {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken) {
      await fetch(revokeEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: refreshToken,
          token_type_hint: "refresh_token",
        }),
      }).catch(() => {}); // Fail silently to ensure local logout completes
    }
    await tokenStorage.clear();
  },
};
```

### 3.2 API Client with Auto-Refresh

**File:** `packages/mobile/src/services/api.ts`

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { authService } from "./auth";
import { authState } from "./authState";

const apiClient = axios.create({
  baseURL: "https://your-backend.com/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await authService.getValidToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (
    error: AxiosError & {
      config?: InternalAxiosRequestConfig & { _retry?: boolean };
    },
  ) => {
    const config = error.config;
    if (error.response?.status === 401 && config && !config._retry) {
      config._retry = true;
      if (await authService.refreshToken()) {
        const newToken = await authService.getValidToken();
        if (newToken) config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(config);
      }
      authState.emit(); // Notify app to logout
    }
    return Promise.reject(error);
  },
);

export { apiClient };
```

### 3.3 Auth State & Context

**File:** `packages/mobile/src/services/authState.ts`

```typescript
type Listener = () => void;
const listeners = new Set<Listener>();
export const authState = {
  onUnauthenticated: (fn: Listener) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit: () => listeners.forEach((fn) => fn()),
};
```

**File:** `packages/mobile/src/contexts/AuthContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { authService, tokenStorage } from "../services/auth";
import { authState } from "../services/authState";

const AuthContext = createContext<any>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (await authService.isAuthenticated()) {
          setUser(await tokenStorage.getUser());
          setIsAuthenticated(true);
        }
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    })();
    const unsubscribe = authState.onUnauthenticated(() => {
      setUser(null);
      setIsAuthenticated(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async () => {
    const result = await authService.login();
    if (result.success) {
      setUser(await tokenStorage.getUser());
      setIsAuthenticated(true);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout("https://your-backend.com/oauth/revoke");
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
```

### 3.4 UI Screens

_Note: Removed incorrect "Redux" references from UI text._

**File:** `packages/mobile/src/screens/LoginScreen.tsx`

```typescript
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from "react-native";
import { useAuth } from "../contexts/AuthContext";

export function LoginScreen() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const result = await login();
    setLoading(false);
    if (!result.success && result.error !== "cancelled") {
      Alert.alert("Login Failed", result.error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Lerna Mono Demo</Text>
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in with OAuth</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
// ... (Styles omitted for brevity, see original guide for full StyleSheet)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 40 },
  button: { backgroundColor: "#3498db", paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

**File:** `packages/mobile/src/App.tsx`

```typescript
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoginScreen } from "./screens/LoginScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ActivityIndicator, View } from "react-native";

const Stack = createStackNavigator();

function Navigator() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <View style={{flex:1,justifyContent:'center'}}><ActivityIndicator /></View>;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? <Stack.Screen name="Home" component={HomeScreen} /> : <Stack.Screen name="Login" component={LoginScreen} />}
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

## 4. Backend OAuth Implementation

**File:** `packages/app/src/routes/oauth.ts`  
_⚠️ The example below uses an in-memory Map for PKCE. This is for **development only**._

```typescript
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const router = express.Router();
const pkceCodes = new Map<string, string>(); // ⚠️ Replace with Redis in production

router.get("/oauth/authorize", (req, res) => {
  const { redirect_uri, code_challenge, state } = req.query;
  if (!code_challenge || !state)
    return res.status(400).json({ error: "Missing PKCE params" });

  pkceCodes.set(state as string, code_challenge as string);
  const authCode = crypto.randomBytes(32).toString("hex");
  res.redirect(`${redirect_uri}?code=${authCode}&state=${state}`);
});

router.post("/oauth/token", async (req, res) => {
  const { grant_type, code_verifier, state, code, refresh_token } = req.body;

  if (grant_type === "authorization_code") {
    const storedChallenge = pkceCodes.get(state);
    if (!storedChallenge)
      return res.status(400).json({ error: "Invalid state" });

    const challenge = crypto
      .createHash("sha256")
      .update(code_verifier)
      .digest("base64url");
    if (challenge !== storedChallenge)
      return res.status(400).json({ error: "PKCE failed" });

    pkceCodes.delete(state);
    return issueTokens(res, "user-id");
  }

  if (grant_type === "refresh_token") {
    try {
      const decoded = jwt.verify(refresh_token, process.env.JWT_SECRET!) as any;
      if (decoded.type !== "refresh") throw new Error("Invalid token");
      return issueTokens(res, decoded.userId);
    } catch {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
  }
  return res.status(400).json({ error: "Unsupported grant_type" });
});

function issueTokens(res: express.Response, userId: string) {
  const accessToken = jwt.sign(
    { sub: userId, name: "Demo User" },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" },
  );
  const refreshToken = jwt.sign(
    { userId, type: "refresh" },
    process.env.JWT_SECRET!,
    { expiresIn: "30d" },
  );
  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 3600,
  });
}

export default router;
```

---

## 5. Running the Application

### 🛑 Important: Custom Dev Client

You cannot run this app in Expo Go. You must build a custom client once per native dependency change.

### 🪟 Windows (Android)

1.  **Build Dev Client (First Time):**
    ```bash
    cd packages/mobile
    eas login
    eas build --profile development --platform android
    ```
    Install the downloaded `.apk` on your emulator (`adb install path.apk`).
2.  **Daily Dev:**
    ```bash
    npm run dev-client  # Starts Metro
    ```
    Press `a` in Metro terminal to launch on Android.

### 🍎 Mac Mini (iOS)

1.  **Install Pods (First Time & After Native Changes):**
    ```bash
    cd packages/mobile/ios
    pod install
    ```
2.  **Build Dev Client (First Time):**
    ```bash
    eas build --profile development --platform ios
    ```
    Install the `.app` on Simulator (`xcrun simctl install booted path/to/app.app`).
3.  **Daily Dev:**
    ```bash
    npm run dev-client
    ```
    Press `i` in Metro terminal to launch on iOS.

### 🌐 Connecting Mac to Windows Backend

If running the backend on Windows but testing iOS on Mac:

1.  Find Windows IP: `ipconfig` (look for IPv4 Address).
2.  Update `packages/mobile/src/services/api.ts` and `auth.ts`:
    ```typescript
    // Replace localhost with Windows IP
    const API_BASE_URL = "https://192.168.1.XX:3000/api";
    ```
3.  **HTTPS:** OAuth requires HTTPS. Use `mkcert` to generate a trusted local certificate on Windows, or accept the security warning in the iOS simulator.

---

## 6. Troubleshooting & Checklist

### Common Errors

| Error                      | Fix                                                                       |
| :------------------------- | :------------------------------------------------------------------------ |
| `Unable to resolve module` | Check `metro.config.js` includes monorepo root.                           |
| `atob is not defined`      | Ensure you are using `jwt-decode`, not native `atob`.                     |
| `No native module found`   | You are using Expo Go. Build a Custom Dev Client via EAS.                 |
| `PKCE verification failed` | Ensure `state` is passed correctly between authorize and token endpoints. |
| `SSL Error (iOS)`          | Use `mkcert` for local HTTPS or add `NSAllowsArbitraryLoads` (Dev only).  |

### Production Checklist

- [ ] **PKCE Storage:** Switch backend from `Map` to Redis.
- [ ] **Token Revocation:** Implement JTI blocklist in backend.
- [ ] **Secrets:** Ensure no client secrets are hardcoded in the mobile app.
- [ ] **HTTPS:** Enforce HTTPS for all OAuth endpoints.
- [ ] **Line Endings:** Ensure `core.autocrlf input` is set to prevent script errors on Mac.
- [ ] **iOS Privacy:** Remove `NSAllowsArbitraryLoads` before App Store submission.

## Here is a summary of the key changes and improvements made during the rewrite, comparing the **original file content** to the **rewritten guide**:

### 1. Structure & Flow Optimization

- **Condensed Steps:** The original guide had **11 sequential steps**. I consolidated these into **6 logical sections** (Environment, Monorepo Integration, App Code, Backend, Running, Troubleshooting). This reduces cognitive load and makes the guide easier to scan.
- **Pre-Flight Checks:** I moved the "Read This First" warnings to a **"Critical Pre-Flight Checks"** section at the very top. These are the most common failure points (Metro symlinks, Expo Go limitations, `atob` errors), so they now appear before any setup instructions.
- **Removed ASCII Diagrams:** Removed the ASCII art workflow diagram to save space and improve readability on different screen sizes, replacing it with a concise text description of the Windows/Mac workflow.

### 2. Technical Consistency Fixes

- **Redux vs. Context API:** The original `LoginScreen.tsx` contained a subtitle saying **"React 19 + Redux 5"**, but the actual code implementation used **React Context API** (`AuthContext`), not Redux. I removed the incorrect "Redux" reference to prevent confusion.
- **Code Conciseness:** I streamlined some of the TypeScript code blocks (e.g., `App.tsx`, `AuthContext.tsx`) by removing verbose formatting while preserving functionality, making the core logic easier to copy-paste.
- **Backend Warning:** I clarified the warning about the **in-memory PKCE storage** in the backend code, explicitly marking it as "Development Only" with a clearer comment block to prevent accidental production use.

### 3. Readability & Formatting

- **Troubleshooting Table:** Converted the long "Common Errors & Fixes" list into a **compact table**. This allows developers to quickly scan for their specific error message and find the fix without reading paragraphs of text.
- **Production Checklist:** Streamlined the checklist to focus on the highest-priority security and configuration items (PKCE, HTTPS, Secrets) rather than mixing them with setup tasks like CocoaPods.
- **Environment Setup:** Condensed the detailed "How to install JDK/Android Studio/Xcode" instructions. The rewrite assumes developers can follow official installation docs and focuses instead on the **monorepo-specific configurations** (like `metro.config.js` and `core.autocrlf`).

### 4. Focus on Monorepo Specifics

- **Metro Configuration:** I highlighted the `metro.config.js` changes as a critical step (**Step 2.3**) with a specific warning icon ⚠️. In the original, this was buried in Step 2. This is the most common breaker for monorepo RN apps, so I gave it more prominence.
- **Cross-OS Workflow:** Clarified the Windows/Mac split workflow earlier in the document, emphasizing that Metro runs independently on each machine and syncs via Git, rather than implying a shared network Metro instance.

### 5. Content Removed (for Brevity)

- **Basic IDE Setup:** Removed detailed steps on installing VS Code extensions or creating Android Virtual Devices (AVD), as these are standard RN setup tasks available in official docs. The guide now focuses on the **Lerna + React Native integration** specifics.
- **Redundant Comments:** Cleaned up excessive comments in code blocks (e.g., `// ──────────────────`) to make the code look more like a production codebase and less like a tutorial snippet.

### Summary

The core logic (OAuth flow, PKCE, Secure Store, Metro config) remains **identical** to ensure technical accuracy. The changes were primarily aimed at **usability, consistency, and scanability**, ensuring a developer can get from "clone repo" to "running app" with fewer distractions.
