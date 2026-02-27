# 📱 Adding React Native Mobile Support to a Lerna Monorepo

> A production-ready guide with fixes for common pitfalls around Metro config, PKCE storage, token security, and Expo compatibility.

---

## ⚠️ Read This First

Before writing a single line of code, understand these three realities about React Native + monorepos:

1. **Metro bundler does not understand monorepo symlinks by default.** This must be manually configured or your app will fail to build entirely. This is the most common blocker and the guide addresses it first.
2. **`react-native-app-auth` requires a custom Expo dev client.** It will not work in Expo Go. Plan for this.
3. **`atob()` does not exist in React Native's JS environment.** Any code that uses it (including the previous guide's JWT decoder) will crash at runtime.

---

## 📁 Monorepo Structure

```
react-lerna-mono-repo/
├── packages/
│   ├── app/              # Express backend
│   ├── web/              # Web frontend
│   ├── common/           # Shared types/utilities
│   └── mobile/           # React Native (Expo) — NEW
├── lerna.json
└── package.json
```

---

## Step 1: Create the Mobile Package

```bash
cd packages
npx create-expo-app mobile --template blank-typescript
cd mobile
```

Install dependencies — use current, pinned versions:

```bash
# Auth
npm install react-native-app-auth expo-secure-store expo-web-browser

# HTTP client
npm install axios

# Navigation
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context

# JWT decoding (replaces atob — which does NOT exist in React Native)
npm install jwt-decode

# Custom dev client (required for react-native-app-auth)
npm install expo-dev-client
```

---

## Step 2: Configure Metro for the Monorepo ⚠️

This is the step most guides skip. Without it, Metro cannot resolve packages that live outside the `mobile/` directory (including your `common` package).

### `packages/mobile/metro.config.js`

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Root of the entire monorepo
const monorepoRoot = path.resolve(__dirname, "../..");

const config = getDefaultConfig(__dirname);

// Watch all packages in the monorepo, not just mobile/
config.watchFolders = [monorepoRoot];

// Tell Metro where to find node_modules
// It checks mobile/node_modules first, then falls back to the root
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Required for monorepo symlink resolution
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

### Why each setting matters

- **`watchFolders`** — without this, changes to `packages/common` won't trigger a hot reload in the mobile app.
- **`nodeModulesPaths`** — prevents "Unable to resolve module" errors for packages that are hoisted to the monorepo root.
- **`disableHierarchicalLookup`** — prevents Metro from traversing up the directory tree in ways that conflict with Lerna's hoisting.

---

## Step 3: Package Configuration

### `packages/mobile/package.json`

```json
{
  "name": "@demo/mobile",
  "version": "1.0.0",
  "main": "src/App.tsx",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "dev-client": "expo start --dev-client",
    "build:ios": "eas build --platform ios",
    "build:android": "eas build --platform android",
    "test": "jest"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-dev-client": "~4.0.0",
    "expo-secure-store": "~13.0.0",
    "expo-web-browser": "~13.0.0",
    "react-native-app-auth": "^7.1.0",
    "axios": "^1.7.0",
    "jwt-decode": "^4.0.0",
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

> **Note:** `react-native-app-auth` contains native code. You **must** run the app with `expo start --dev-client` (not `expo start`), and you must build a custom dev client with `eas build`. Standard Expo Go will not work.

---

## Step 4: Deep Linking Configuration

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
          {
            "CFBundleURLSchemes": ["com.demo.mobile"]
          }
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

---

## Step 5: Authentication Service

Key differences from the original guide:
- Uses `jwt-decode` instead of a custom `atob()` decoder (which crashes in React Native)
- Expiry calculation uses `accessTokenExpirationDate` correctly
- No silent failure on missing refresh tokens

### `packages/mobile/src/services/auth.ts`

```typescript
import * as SecureStore from "expo-secure-store";
import { authorize, refresh, AuthorizeResult } from "react-native-app-auth";
import * as WebBrowser from "expo-web-browser";
import { jwtDecode } from "jwt-decode"; // ✅ Works in React Native — atob() does NOT

// ─────────────────────────────────────────────────────────────
// 🔧 Configuration
// Update these values to match your backend
// ─────────────────────────────────────────────────────────────
const OAUTH_CONFIG = {
  issuer: "https://your-backend.com",
  clientId: "YOUR_MOBILE_CLIENT_ID",
  redirectUrl: "com.demo.mobile://callback",
  scopes: ["openid", "profile", "email"],
  usePKCE: true, // react-native-app-auth handles PKCE automatically
  serviceConfiguration: {
    authorizationEndpoint: "https://your-backend.com/oauth/authorize",
    tokenEndpoint: "https://your-backend.com/oauth/token",
    revocationEndpoint: "https://your-backend.com/oauth/revoke",
  },
};

// ─────────────────────────────────────────────────────────────
// 🔑 Storage Keys
// ─────────────────────────────────────────────────────────────
const KEYS = {
  ACCESS_TOKEN: "auth.access_token",
  REFRESH_TOKEN: "auth.refresh_token",
  TOKEN_EXPIRY: "auth.token_expiry",
  USER_DATA: "auth.user_data",
} as const;

// ─────────────────────────────────────────────────────────────
// 🛡️ Secure Token Storage
// Uses device Keychain (iOS) / Keystore (Android) via expo-secure-store
// ─────────────────────────────────────────────────────────────
export interface StoredUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export const tokenStorage = {
  async save(params: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string; // ISO date string from react-native-app-auth
    user: StoredUser;
  }): Promise<void> {
    const expiryMs = new Date(params.expiresAt).getTime() - 5 * 60 * 1000; // 5min buffer
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, params.accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, params.refreshToken),
      SecureStore.setItemAsync(KEYS.TOKEN_EXPIRY, String(expiryMs)),
      SecureStore.setItemAsync(KEYS.USER_DATA, JSON.stringify(params.user)),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async isExpired(): Promise<boolean> {
    const expiry = await SecureStore.getItemAsync(KEYS.TOKEN_EXPIRY);
    if (!expiry) return true;
    return Date.now() >= parseInt(expiry, 10);
  },

  async getUser(): Promise<StoredUser | null> {
    const raw = await SecureStore.getItemAsync(KEYS.USER_DATA);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.TOKEN_EXPIRY),
      SecureStore.deleteItemAsync(KEYS.USER_DATA),
    ]);
  },
};

// ─────────────────────────────────────────────────────────────
// 🔄 Auth Service
// ─────────────────────────────────────────────────────────────
export const authService = {
  /**
   * Initiate OAuth 2.0 + PKCE login flow.
   * Opens the system browser — react-native-app-auth handles
   * PKCE code_verifier/code_challenge generation automatically.
   */
  async login(): Promise<{ success: boolean; error?: string }> {
    try {
      await WebBrowser.maybeCompleteAuthSession();
      const result: AuthorizeResult = await authorize(OAUTH_CONFIG);

      // Decode JWT for display data only — never for authorization decisions
      // Authorization is always enforced server-side
      const user = jwtDecode<StoredUser>(result.accessToken);

      await tokenStorage.save({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? "",
        expiresAt: result.accessTokenExpirationDate,
        user,
      });

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      // User cancelling the browser is not a real error
      if (message.includes("User cancelled") || message.includes("cancelled")) {
        return { success: false, error: "cancelled" };
      }
      console.error("[authService.login]", error);
      return { success: false, error: message };
    }
  },

  /**
   * Use the refresh token to obtain a new access token.
   * Returns false and clears storage if refresh fails (forces re-login).
   */
  async refreshToken(): Promise<boolean> {
    const currentRefreshToken = await tokenStorage.getRefreshToken();
    if (!currentRefreshToken) return false;

    try {
      const result = await refresh(OAUTH_CONFIG, {
        refreshToken: currentRefreshToken,
      });

      const user = jwtDecode<StoredUser>(result.accessToken);

      await tokenStorage.save({
        accessToken: result.accessToken,
        // Server may rotate the refresh token — use new one if provided
        refreshToken: result.refreshToken ?? currentRefreshToken,
        expiresAt: result.accessTokenExpirationDate,
        user,
      });

      return true;
    } catch (error) {
      console.error("[authService.refreshToken]", error);
      await tokenStorage.clear();
      return false;
    }
  },

  /**
   * Returns a valid access token, refreshing if needed.
   * Returns null if the user needs to log in again.
   */
  async getValidToken(): Promise<string | null> {
    const expired = await tokenStorage.isExpired();
    if (expired) {
      const refreshed = await this.refreshToken();
      if (!refreshed) return null;
    }
    return tokenStorage.getAccessToken();
  },

  /**
   * Check whether the user has an active session.
   * Attempts a token refresh before returning false.
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await tokenStorage.getAccessToken();
    if (!token) return false;
    const expired = await tokenStorage.isExpired();
    if (!expired) return true;
    return this.refreshToken();
  },

  /**
   * Revoke tokens on the server, then clear local storage.
   */
  async logout(revokeEndpoint: string): Promise<void> {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (refreshToken) {
        // Best-effort server revocation — don't block logout on failure
        await fetch(revokeEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: refreshToken,
            token_type_hint: "refresh_token",
          }).toString(),
        }).catch(() => {}); // Intentional: local logout must always succeed
      }
    } finally {
      await tokenStorage.clear();
    }
  },
};
```

---

## Step 6: API Client with Auto-Refresh

Key fix: the original guide's `EventEmitter` was a fragile hand-rolled singleton. This version uses a proper callback pattern via a shared auth state module.

### `packages/mobile/src/services/authState.ts`

```typescript
// Thin module for cross-cutting auth state changes
// Avoids the brittle custom EventEmitter from the original guide
type Listener = () => void;
const listeners = new Set<Listener>();

export const authState = {
  onUnauthenticated: (fn: Listener) => {
    listeners.add(fn);
    return () => listeners.delete(fn); // returns unsubscribe function
  },
  emit: () => listeners.forEach((fn) => fn()),
};
```

### `packages/mobile/src/services/api.ts`

```typescript
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { authService } from "./auth";
import { authState } from "./authState";

const API_BASE_URL = "https://your-backend.com/api";

// Extend config type to track retry attempts
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every outgoing request
apiClient.interceptors.request.use(async (config) => {
  const token = await authService.getValidToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — attempt token refresh once, then signal logout
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;

    if (error.response?.status === 401 && config && !config._retry) {
      config._retry = true;
      const refreshed = await authService.refreshToken();

      if (refreshed) {
        const newToken = await authService.getValidToken();
        if (newToken && config.headers) {
          config.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(config);
      }

      // Refresh failed — notify the UI layer to redirect to login
      authState.emit();
    }

    return Promise.reject(error);
  }
);

export { apiClient };
```

---

## Step 7: Auth Context

### `packages/mobile/src/contexts/AuthContext.tsx`

```typescript
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { authService, tokenStorage, StoredUser } from "../services/auth";
import { authState } from "../services/authState";

const REVOKE_ENDPOINT = "https://your-backend.com/oauth/revoke";

interface AuthContextType {
  user: StoredUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleUnauthenticated = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    // Check existing session on mount
    (async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        if (authenticated) {
          const userData = await tokenStorage.getUser();
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("[AuthProvider] session check failed", e);
      } finally {
        setIsLoading(false);
      }
    })();

    // Subscribe to forced logout events (e.g. 401 after refresh failure)
    const unsubscribe = authState.onUnauthenticated(handleUnauthenticated);
    return unsubscribe;
  }, [handleUnauthenticated]);

  const login = useCallback(async () => {
    const result = await authService.login();
    if (result.success) {
      const userData = await tokenStorage.getUser();
      setUser(userData);
      setIsAuthenticated(true);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout(REVOKE_ENDPOINT);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

---

## Step 8: Screens

### `packages/mobile/src/screens/LoginScreen.tsx`

```typescript
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
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
        <Text style={styles.subtitle}>React 19 + Redux 5</Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in with OAuth</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>OAuth 2.0 + PKCE · Encrypted token storage</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  logo: { fontSize: 72, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#2c3e50" },
  subtitle: { fontSize: 14, color: "#7f8c8d", marginBottom: 48 },
  button: {
    backgroundColor: "#3498db",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#95a5a6" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  hint: { marginTop: 24, fontSize: 12, color: "#95a5a6", textAlign: "center" },
});
```

### `packages/mobile/src/screens/HomeScreen.tsx`

```typescript
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/api";

// Locally-scoped type — does not conflict with StoredUser from auth
interface ApiUser {
  id: number;
  name: string;
  email: string;
}

export function HomeScreen() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const onRefresh = () => { setRefreshing(true); fetchUsers(); };

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2c3e50",
    padding: 16,
  },
  greeting: { color: "#fff", fontSize: 16, fontWeight: "600" },
  email: { color: "#bdc3c7", fontSize: 12, marginTop: 2 },
  logoutBtn: {
    backgroundColor: "#e74c3c",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  logoutText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  list: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#2c3e50", marginBottom: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3498db",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  name: { fontSize: 15, fontWeight: "600", color: "#2c3e50" },
  emailSmall: { fontSize: 12, color: "#7f8c8d", marginTop: 2 },
  errorText: { color: "#e74c3c", fontSize: 14, textAlign: "center", padding: 24 },
});
```

---

## Step 9: App Root & Navigation

### `packages/mobile/src/App.tsx`

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
      {isAuthenticated ? (
        <Stack.Screen name="Home" component={HomeScreen} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
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

## Step 10: Backend OAuth Endpoints

The original guide stored PKCE codes in an in-memory `Map`. This breaks across server restarts and multi-instance deployments. Use Redis (or any shared cache) in production.

### `packages/app/src/routes/oauth.ts`

```typescript
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
// In production: import Redis client here
// import { redis } from "../lib/redis";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// PKCE code storage
//
// ⚠️  The Map below is DEVELOPMENT ONLY.
//     In production, replace with Redis so codes survive
//     restarts and work across multiple server instances.
//     Example: await redis.setex(`pkce:${state}`, 300, challenge)
// ─────────────────────────────────────────────────────────────
const pkceCodes = new Map<string, string>(); // state → code_challenge

// ─────────────────────────────────────────────────────────────
// GET /oauth/authorize
// Validates PKCE parameters and redirects with an auth code
// ─────────────────────────────────────────────────────────────
router.get("/oauth/authorize", (req, res) => {
  const { redirect_uri, code_challenge, code_challenge_method, state } = req.query;

  if (!code_challenge || code_challenge_method !== "S256") {
    return res.status(400).json({ error: "PKCE with S256 is required" });
  }

  if (!state) {
    return res.status(400).json({ error: "state parameter is required" });
  }

  // Associate the PKCE challenge with this authorization attempt
  pkceCodes.set(state as string, code_challenge as string);

  const authCode = crypto.randomBytes(32).toString("hex");

  // In production, store authCode → state mapping so you can
  // look up the challenge when the token request arrives
  res.redirect(`${redirect_uri}?code=${authCode}&state=${state}`);
});

// ─────────────────────────────────────────────────────────────
// POST /oauth/token
// Handles authorization_code and refresh_token grant types
// ─────────────────────────────────────────────────────────────
router.post("/oauth/token", async (req, res) => {
  const { grant_type, code_verifier, refresh_token } = req.body;

  if (grant_type === "authorization_code") {
    const { code, state } = req.body;
    const storedChallenge = pkceCodes.get(state);

    if (!storedChallenge) {
      return res.status(400).json({ error: "Invalid or expired authorization code" });
    }

    // Verify the code_verifier produces the stored code_challenge
    const challenge = crypto
      .createHash("sha256")
      .update(code_verifier)
      .digest("base64url"); // base64url encoding — no manual replace needed in Node 16+

    if (challenge !== storedChallenge) {
      return res.status(400).json({ error: "PKCE verification failed" });
    }

    pkceCodes.delete(state); // Codes are single-use

    return issueTokens(res, "user-from-db");
  }

  if (grant_type === "refresh_token") {
    if (!refresh_token) {
      return res.status(400).json({ error: "refresh_token is required" });
    }

    try {
      const decoded = jwt.verify(refresh_token, process.env.JWT_SECRET!) as {
        userId: string;
        type: string;
      };

      if (decoded.type !== "refresh") {
        return res.status(400).json({ error: "Invalid token type" });
      }

      // In production: check token against a revocation list / database
      return issueTokens(res, decoded.userId);
    } catch {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
  }

  return res.status(400).json({ error: "Unsupported grant_type" });
});

// ─────────────────────────────────────────────────────────────
// POST /oauth/revoke
// Adds the token to a revocation list
//
// ⚠️  The no-op implementation below is DEVELOPMENT ONLY.
//     In production, store the JTI (JWT ID) in Redis with the
//     token's remaining TTL. Middleware should reject any
//     access token whose JTI appears in the revocation list.
// ─────────────────────────────────────────────────────────────
router.post("/oauth/revoke", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });

  // Production: decode token, extract jti, add to Redis revocation list
  // await redis.setex(`revoked:${jti}`, remainingTtl, "1")

  res.json({ revoked: true });
});

// ─────────────────────────────────────────────────────────────
// Helper: sign and return access + refresh token pair
// ─────────────────────────────────────────────────────────────
function issueTokens(res: express.Response, userId: string) {
  const jti = crypto.randomUUID(); // Unique ID enables revocation

  const accessToken = jwt.sign(
    { sub: userId, email: "user@demo.com", name: "Demo User", jti },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );

  const refreshToken = jwt.sign(
    { userId, type: "refresh" },
    process.env.JWT_SECRET!,
    { expiresIn: "30d" }
  );

  return res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 3600,
  });
}

export default router;
```

---

## Step 11: Running the App

```bash
# 1. Start backend (HTTPS required for OAuth redirects)
cd packages/app && npm run dev:https

# 2. Build and install custom dev client (first time only)
cd packages/mobile
npx eas build --profile development --platform ios   # or android
# Install the resulting .ipa / .apk on your device/simulator

# 3. Start Metro bundler
npm run dev-client

# 4. Open the app using the custom dev client (not Expo Go)
```

> **Why not Expo Go?** `react-native-app-auth` includes native iOS/Android code that must be compiled into the app bundle. Expo Go ships with a fixed set of native modules and cannot load custom ones at runtime. The custom dev client is essentially Expo Go rebuilt to include your app's native dependencies.

---

## Production Checklist

| Area | Item | Notes |
|---|---|---|
| **PKCE** | Replace in-memory Map with Redis | Required for multi-instance / restarts |
| **Revocation** | Implement JTI blocklist | No-op revocation endpoint is insecure |
| **JWT decode** | Client-side decode is display-only | Never use for authorization |
| **Metro** | `metro.config.js` configured | Required for monorepo module resolution |
| **Dev client** | Built with `eas build` | `react-native-app-auth` won't run in Expo Go |
| **Secrets** | No client secret in mobile app | Public client PKCE flow only |
| **HTTPS** | All endpoints HTTPS | Required for OAuth redirects |
| **Token rotation** | Refresh tokens rotate on use | Already handled in `issueTokens()` |
| **Error boundaries** | Wrap Navigator in `<ErrorBoundary>` | Prevents blank screens on unhandled errors |
| **Biometrics** | Consider `expo-local-authentication` | Prompt before showing sensitive data |

---

## Common Errors & Fixes

**`Unable to resolve module X from packages/mobile`**
→ Your `metro.config.js` is missing or `nodeModulesPaths` doesn't include the monorepo root.

**`atob is not defined`**
→ Replace any `atob()` usage with `jwt-decode`. This library uses React Native-compatible base64 parsing.

**`react-native-app-auth: No native module found`**
→ You're running in Expo Go. Build and install a custom dev client via `eas build`.

**`Invalid code_verifier` on token exchange**
→ The PKCE challenge stored server-side doesn't match. Ensure the `state` parameter is passed through the redirect and correctly keyed in your storage.

**App hangs after OAuth redirect**
→ Ensure `WebBrowser.maybeCompleteAuthSession()` is called at the top of your login function, and that your `scheme` in `app.json` matches the `redirectUrl` in `OAUTH_CONFIG`.
