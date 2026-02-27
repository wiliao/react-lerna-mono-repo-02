# 📱 Adding React Native Mobile Support to a Lerna Monorepo

> **Production-ready guide:** Cross-platform development with Android on Windows and iOS on Mac Mini, covering OAuth 2.0 + PKCE, secure token storage, and monorepo-specific Metro configuration.

---

## ⚠️ Critical Pre-Flight Checks

Before writing any code, acknowledge these four constraints:

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
│   ├── web/              # React web frontend
│   ├── common/           # Shared types & utilities
│   └── mobile/           # React Native — NEW
├── lerna.json
└── package.json
```

---

## 3. Create the Mobile Package

```bash
cd packages
npx create-expo-app mobile --template blank-typescript
cd mobile
```

Install all dependencies:
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
```

---

## 4. Configuration Files

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

This prevents hardcoding machine IPs into source-controlled files. Use this instead of editing `api.ts` or `auth.ts` directly when switching between Windows and Mac Mini backends.

```javascript
// app.config.js
import "dotenv/config";

export default {
  expo: {
    extra: {
      // Set BACKEND_URL in a local .env file — never commit .env
      // Windows dev:  BACKEND_URL=https://192.168.1.x:3000
      // Mac dev:      BACKEND_URL=https://localhost:3000
      // Production:   BACKEND_URL=https://your-production-domain.com
      backendUrl: process.env.BACKEND_URL ?? "https://localhost:3000",
    },
  },
};
```

Create a `.env` file (add to `.gitignore`):
```bash
# packages/mobile/.env — never commit this file
BACKEND_URL=https://192.168.1.x:3000
```

Install the dotenv dependency:
```bash
npm install dotenv
```

---

## 5. Application Code

### 5.1 `packages/mobile/src/services/auth.ts`

Key points:
- Uses `jwt-decode` — `atob()` does not exist in React Native
- JWT data is used for display only — never for authorization decisions
- `isAuthenticated()` is defined here and used by `AuthContext`
- Tokens are saved with `Promise.all` to avoid partial writes

```typescript
import * as SecureStore from "expo-secure-store";
import { authorize, refresh, AuthorizeResult } from "react-native-app-auth";
import * as WebBrowser from "expo-web-browser";
import { jwtDecode } from "jwt-decode";
import Constants from "expo-constants";

const backendUrl: string = Constants.expoConfig?.extra?.backendUrl ?? "https://localhost:3000";

// ─────────────────────────────────────────────────────────────
// OAuth Configuration
// ─────────────────────────────────────────────────────────────
const OAUTH_CONFIG = {
  issuer: backendUrl,
  clientId: "YOUR_MOBILE_CLIENT_ID",
  redirectUrl: "com.demo.mobile://callback",
  scopes: ["openid", "profile", "email"],
  usePKCE: true, // react-native-app-auth handles code_verifier/challenge generation
  serviceConfiguration: {
    authorizationEndpoint: `${backendUrl}/oauth/authorize`,
    tokenEndpoint: `${backendUrl}/oauth/token`,
    revocationEndpoint: `${backendUrl}/oauth/revoke`,
  },
};

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface StoredUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

interface SaveTokenParams {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO date string from react-native-app-auth
  user: StoredUser;
}

// ─────────────────────────────────────────────────────────────
// Storage Keys
// ─────────────────────────────────────────────────────────────
const KEYS = {
  ACCESS_TOKEN:  "auth.access_token",
  REFRESH_TOKEN: "auth.refresh_token",
  TOKEN_EXPIRY:  "auth.token_expiry",
  USER_DATA:     "auth.user_data",
} as const;

// ─────────────────────────────────────────────────────────────
// Token Storage
// Encrypted via device Keychain (iOS) / Keystore (Android)
// ─────────────────────────────────────────────────────────────
export const tokenStorage = {
  async save({ accessToken, refreshToken, expiresAt, user }: SaveTokenParams): Promise<void> {
    // Subtract 5-minute buffer so we refresh before the token actually expires
    const expiryMs = new Date(expiresAt).getTime() - 5 * 60 * 1000;
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN,  accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
      SecureStore.setItemAsync(KEYS.TOKEN_EXPIRY,  String(expiryMs)),
      SecureStore.setItemAsync(KEYS.USER_DATA,     JSON.stringify(user)),
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
    await Promise.all(
      Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k))
    );
  },
};

// ─────────────────────────────────────────────────────────────
// Auth Service
// ─────────────────────────────────────────────────────────────
export const authService = {
  /**
   * Initiates OAuth 2.0 + PKCE login.
   * react-native-app-auth generates the code_verifier and code_challenge
   * automatically — no manual PKCE implementation required on the client.
   */
  async login(): Promise<{ success: boolean; error?: string }> {
    try {
      await WebBrowser.maybeCompleteAuthSession();
      const result: AuthorizeResult = await authorize(OAUTH_CONFIG);

      // Decode JWT for display purposes only.
      // This is NOT used for authorization — the server validates every request.
      const user = jwtDecode<StoredUser>(result.accessToken);

      await tokenStorage.save({
        accessToken:  result.accessToken,
        refreshToken: result.refreshToken ?? "",
        expiresAt:    result.accessTokenExpirationDate,
        user,
      });

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      // User closing the browser is not an error worth alerting on
      if (message.toLowerCase().includes("cancel")) {
        return { success: false, error: "cancelled" };
      }
      console.error("[authService.login]", error);
      return { success: false, error: message };
    }
  },

  /**
   * Exchanges the refresh token for a new access token.
   * Clears storage and returns false if the refresh token is invalid or expired,
   * forcing the user back to the login screen.
   */
  async refreshToken(): Promise<boolean> {
    const currentRefreshToken = await tokenStorage.getRefreshToken();
    if (!currentRefreshToken) return false;

    try {
      const result = await refresh(OAUTH_CONFIG, { refreshToken: currentRefreshToken });
      const user = jwtDecode<StoredUser>(result.accessToken);

      await tokenStorage.save({
        accessToken:  result.accessToken,
        // Server may rotate the refresh token on use — always prefer the new one
        refreshToken: result.refreshToken ?? currentRefreshToken,
        expiresAt:    result.accessTokenExpirationDate,
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
   * Returns a valid access token, transparently refreshing if expired.
   * Returns null if the user must log in again.
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
   * Returns true if the user has an active session.
   * Attempts a token refresh before returning false to handle the case
   * where the access token expired while the app was backgrounded.
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await tokenStorage.getAccessToken();
    if (!token) return false;
    const expired = await tokenStorage.isExpired();
    if (!expired) return true;
    return this.refreshToken();
  },

  /**
   * Revokes the refresh token on the server, then clears local storage.
   * Local logout always completes even if the server revocation call fails.
   */
  async logout(): Promise<void> {
    try {
      const currentRefreshToken = await tokenStorage.getRefreshToken();
      if (currentRefreshToken) {
        await fetch(`${backendUrl}/oauth/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: currentRefreshToken,
            token_type_hint: "refresh_token",
          }).toString(),
        }).catch(() => {}); // Intentional: never block local logout on a network failure
      }
    } finally {
      await tokenStorage.clear();
    }
  },
};
```

---

### 5.2 `packages/mobile/src/services/authState.ts`

A minimal pub/sub module for signalling forced logouts (e.g. after a 401 that refresh couldn't fix) across the API layer and the React context without coupling them directly.

```typescript
type Listener = () => void;
const listeners = new Set<Listener>();

export const authState = {
  onUnauthenticated(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn); // returns unsubscribe function
  },
  emit(): void {
    listeners.forEach((fn) => fn());
  },
};
```

---

### 5.3 `packages/mobile/src/services/api.ts`

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { authService } from "./auth";
import { authState } from "./authState";

// Pulled from app.config.js — never hardcode a machine IP here
const backendUrl: string = Constants.expoConfig?.extra?.backendUrl ?? "https://localhost:3000";

// Extend the Axios config type to track retry state
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const apiClient = axios.create({
  baseURL: `${backendUrl}/api`,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Attach a valid JWT to every outgoing request
apiClient.interceptors.request.use(async (config) => {
  const token = await authService.getValidToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: attempt a token refresh once, then signal the UI to log out
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

      // Refresh failed — notify AuthContext to clear state and show login screen
      authState.emit();
    }

    return Promise.reject(error);
  }
);

export { apiClient };
```

---

### 5.4 `packages/mobile/src/contexts/AuthContext.tsx`

Fixes from the reviewed version:
- Fully typed context (no `any`)
- `isAuthenticated()` called correctly from `auth.ts`
- `useCallback` on login/logout prevents unnecessary re-renders

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

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface AuthContextType {
  user: StoredUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                     = useState<StoredUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading]           = useState(true);

  useEffect(() => {
    // Check for an existing valid session on app launch
    (async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        if (authenticated) {
          setUser(await tokenStorage.getUser());
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("[AuthProvider] session check failed", e);
      } finally {
        setIsLoading(false);
      }
    })();

    // Listen for forced logout events emitted by the API interceptor (401 after failed refresh)
    const unsubscribe = authState.onUnauthenticated(() => {
      setUser(null);
      setIsAuthenticated(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const result = await authService.login();
    if (result.success) {
      setUser(await tokenStorage.getUser());
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

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
```

---

### 5.5 `packages/mobile/src/screens/LoginScreen.tsx`

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

### 5.6 `packages/mobile/src/screens/HomeScreen.tsx`

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

// Local type for API response — does not conflict with StoredUser in auth.ts
interface ApiUser {
  id: number;
  name: string;
  email: string;
}

export function HomeScreen() {
  const { user, logout } = useAuth();
  const [users, setUsers]       = useState<ApiUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

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

### 5.7 `packages/mobile/src/App.tsx`

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

## 6. Backend OAuth Endpoints

### `packages/app/src/routes/oauth.ts`

```typescript
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
// Production: import { redis } from "../lib/redis";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// PKCE Code Storage
//
// ⚠️  DEVELOPMENT ONLY — in-memory Map does not survive restarts
//     and breaks across multiple server instances.
//
// Production: replace with Redis
//   Store:  await redis.setex(`pkce:${state}`, 300, challenge)
//   Fetch:  await redis.get(`pkce:${state}`)
//   Delete: await redis.del(`pkce:${state}`)
// ─────────────────────────────────────────────────────────────
const pkceCodes = new Map<string, string>(); // state → code_challenge

// ─────────────────────────────────────────────────────────────
// GET /oauth/authorize
// ─────────────────────────────────────────────────────────────
router.get("/oauth/authorize", (req, res) => {
  const { redirect_uri, code_challenge, code_challenge_method, state } = req.query;

  if (!code_challenge || code_challenge_method !== "S256") {
    return res.status(400).json({ error: "PKCE with S256 is required" });
  }
  if (!state) {
    return res.status(400).json({ error: "state parameter is required" });
  }

  pkceCodes.set(state as string, code_challenge as string);
  const authCode = crypto.randomBytes(32).toString("hex");

  res.redirect(`${redirect_uri}?code=${authCode}&state=${state}`);
});

// ─────────────────────────────────────────────────────────────
// POST /oauth/token
// ─────────────────────────────────────────────────────────────
router.post("/oauth/token", async (req, res) => {
  const { grant_type, code_verifier, state, refresh_token } = req.body;

  if (grant_type === "authorization_code") {
    const storedChallenge = pkceCodes.get(state);
    if (!storedChallenge) {
      return res.status(400).json({ error: "Invalid or expired authorization code" });
    }

    // Node 16+ supports digest("base64url") directly — no manual character replacement needed
    const challenge = crypto
      .createHash("sha256")
      .update(code_verifier)
      .digest("base64url");

    if (challenge !== storedChallenge) {
      return res.status(400).json({ error: "PKCE verification failed" });
    }

    pkceCodes.delete(state); // Authorization codes are single-use
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
      // Production: check decoded.jti against your revocation list here
      return issueTokens(res, decoded.userId);
    } catch {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
  }

  return res.status(400).json({ error: "Unsupported grant_type" });
});

// ─────────────────────────────────────────────────────────────
// POST /oauth/revoke
//
// ⚠️  DEVELOPMENT ONLY — this is a no-op.
//
// Production: extract the jti claim from the token and store it
// in Redis with the token's remaining TTL. Your JWT middleware
// must then reject any access token whose jti is in that set.
//
//   const { jti, exp } = jwt.decode(token) as any;
//   const ttl = exp - Math.floor(Date.now() / 1000);
//   if (ttl > 0) await redis.setex(`revoked:${jti}`, ttl, "1");
// ─────────────────────────────────────────────────────────────
router.post("/oauth/revoke", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });
  // TODO: implement JTI blocklist (see comment above)
  res.json({ revoked: true });
});

// ─────────────────────────────────────────────────────────────
// Helper: issue a token pair
// jti (JWT ID) is included so tokens can be individually revoked
// ─────────────────────────────────────────────────────────────
function issueTokens(res: express.Response, userId: string) {
  const jti = crypto.randomUUID(); // unique per token — required for revocation

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
    access_token:  accessToken,
    refresh_token: refreshToken,
    token_type:    "Bearer",
    expires_in:    3600,
  });
}

export default router;
```

---

## 7. Running the App

> **Why not Expo Go?** `react-native-app-auth` contains native iOS/Android code that must be compiled into the app bundle. Expo Go ships with a fixed native module set and cannot load custom ones at runtime. A Custom Dev Client is essentially Expo Go rebuilt to include your app's native dependencies. You build it once and reuse it — only rebuild when native dependencies change.

---

### 🪟 Windows — Android

**First time only:**
```bash
cd packages/mobile

eas login                           # free Expo account
eas build:configure                 # generates eas.json for the project

# Build Android dev client on Expo's servers (~5 minutes)
eas build --profile development --platform android
```

Install the downloaded `.apk` on your emulator:
```bash
# Option A: drag-and-drop the .apk onto the running emulator window
# Option B:
adb install path/to/your-dev-client.apk
```

**Every development session:**
```bash
# Terminal 1 — backend
cd packages/app && npm run dev:https

# Terminal 2 — Android emulator (if not already running)
emulator -avd Pixel_7_API_34

# Terminal 3 — Metro
cd packages/mobile && npm run dev-client
```

Open the custom dev client on the emulator and press `a` in the Metro terminal, or scan the QR code.

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

eas login   # same Expo account as Windows

# Build iOS dev client (~10 minutes)
# Free Apple account = simulator builds only
# Paid Apple Developer account ($99/yr) = real device + TestFlight
eas build --profile development --platform ios
```

Install on the simulator:
```bash
# Extract the downloaded .tar.gz, then:
xcrun simctl install booted path/to/YourApp.app
```

**Every development session:**
```bash
# Terminal 1 — Metro
cd packages/mobile && npm run dev-client
```

Press `i` in the Metro terminal to launch on the iOS Simulator.

---

### 🌐 Connecting Mac Mini to the Windows Backend

When your backend is running on Windows and you're testing iOS on the Mac Mini, you need to point the mobile app at the Windows machine's local network IP rather than `localhost`.

**Step 1** — Find your Windows IP:
```powershell
ipconfig
# Look for IPv4 Address under your active network adapter, e.g. 192.168.1.42
```

**Step 2** — Set it in the Mac Mini's `.env` file:
```bash
# packages/mobile/.env  (this file is gitignored — not committed)
BACKEND_URL=https://192.168.1.42:3000
```

**Step 3** — Restart Metro so it picks up the new env value:
```bash
npm run dev-client
```

The `app.config.js` reads `BACKEND_URL` at Metro startup and injects it via `expo-constants`. All URLs in `auth.ts` and `api.ts` derive from this single value — there is nothing else to change.

> **HTTPS on the local network:** OAuth requires HTTPS even locally. Your backend's self-signed certificate will show a security warning in the iOS Simulator. To eliminate this, install `mkcert` on Windows, generate a certificate for your local IP, and import the root CA into macOS Keychain on the Mac Mini. Alternatively, add `NSAllowsArbitraryLoads` to your `app.json` `ios.infoPlist` during development only — and remove it before any TestFlight or App Store build.

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
├── npm install          (only if package.json changed)
├── cd ios && pod install  (only if native deps changed)
├── npm run dev-client
└── Verify on iOS Simulator
```

---

### When to Rebuild the Dev Client

Rebuild with `eas build` only when:
- Adding or removing a native dependency (any new Expo module)
- Updating `react-native-app-auth` or the Expo SDK version
- Changing `scheme`, `bundleIdentifier`, or `package` in `app.json`

Regular TypeScript changes, new screens, and API updates do **not** require a rebuild — Metro hot-reloads them instantly.

---

## 8. Production Checklist

| Area | Item | Status |
|---|---|---|
| **PKCE storage** | Replace in-memory `Map` with Redis | Backend — required for restarts & scaling |
| **Token revocation** | Implement JTI blocklist in `/oauth/revoke` | Backend — current no-op is insecure |
| **JWT on client** | Decoded data is display-only | Never use for authorization decisions |
| **Metro config** | `metro.config.js` includes monorepo root | Mobile — required for shared package imports |
| **Dev client** | Built via `eas build` | Mobile — `react-native-app-auth` needs native compilation |
| **No client secrets** | Public client PKCE flow only | Mobile — never embed a client secret |
| **HTTPS** | All OAuth endpoints use HTTPS | Both — required for OAuth redirects |
| **Token rotation** | Refresh tokens rotate on each use | Backend — already in `issueTokens()` |
| **Error boundaries** | Wrap `<Navigator>` in `<ErrorBoundary>` | Mobile — prevents blank screens on uncaught errors |
| **Biometrics** | `expo-local-authentication` before sensitive views | Mobile — optional but recommended |
| **Line endings** | `core.autocrlf input` on Windows | Dev — prevents script corruption on Mac |
| **CocoaPods** | Re-run `pod install` after native dep changes | Mac — easy to forget on branch switches |
| **Environment URLs** | Use `app.config.js` + `.env`, not hardcoded IPs | Both — `.env` must be gitignored |
| **iOS SSL** | Remove `NSAllowsArbitraryLoads` before shipping | Mobile — development workaround only |

---

## 9. Troubleshooting

### General

| Error | Fix |
|---|---|
| `Unable to resolve module X` | `metro.config.js` is missing or `nodeModulesPaths` doesn't include the monorepo root |
| `atob is not defined` | Replace with `jwt-decode` — `atob()` doesn't exist in React Native |
| `No native module found` | You're using Expo Go — build a Custom Dev Client via `eas build` |
| `Invalid code_verifier` | Ensure `state` is passed through the redirect and used as the key for the stored challenge |
| App hangs after OAuth redirect | Check `WebBrowser.maybeCompleteAuthSession()` is called, and `scheme` in `app.json` matches `redirectUrl` in `OAUTH_CONFIG` |

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
