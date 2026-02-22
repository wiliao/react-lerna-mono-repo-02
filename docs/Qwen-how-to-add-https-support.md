# 🔐 Adding HTTPS Support to Your Lerna Mono Repo

Here's a complete, copy-paste ready guide to enable HTTPS for both your **frontend (Webpack)** and **backend (Express)** in development mode.

---

## 📋 Overview

| Environment     | Frontend                                    | Backend                          |
| --------------- | ------------------------------------------- | -------------------------------- |
| **Development** | Webpack Dev Server + self-signed cert       | Express + self-signed cert       |
| **Production**  | Reverse proxy (Nginx/Caddy) + Let's Encrypt | Behind proxy or direct with cert |

---

## 🚀 Quick Start: Development HTTPS

### Step 1: Generate Self-Signed SSL Certificates

Create a script to generate local certificates:

```bash
# packages/web/scripts/generate-cert.sh (Linux/Mac)
#!/bin/bash
mkdir -p ssl
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/CN=localhost"
echo "✅ Certificates generated in packages/web/ssl/"
```

```bash
# packages/web/scripts/generate-cert.bat (Windows)
@echo off
mkdir ssl 2>nul
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/CN=localhost"
echo ✅ Certificates generated in packages/web/ssl/
```

**Run it**:

```bash
# Linux/Mac
chmod +x packages/web/scripts/generate-cert.sh
./packages/web/scripts/generate-cert.sh

# Windows (with Git Bash or WSL)
./packages/web/scripts/generate-cert.bat
```

> 💡 **No OpenSSL?** Install via [Git for Windows](https://git-scm.com/) or use this Node.js alternative:
>
> ```bash
> npx mkcert -install
> npx mkcert localhost
> mv localhost*.pem packages/web/ssl/
> ```

---

### Step 2: Configure Webpack Dev Server for HTTPS

Update `packages/web/webpack.config.js`:

```js
// webpack.config.js
const path = require("path");
const fs = require("fs");

// Load SSL certs if they exist (for HTTPS)
const useHttps = process.env.HTTPS === "true";
const sslOptions =
  useHttps && fs.existsSync("ssl/cert.pem") && fs.existsSync("ssl/key.pem")
    ? {
        key: fs.readFileSync("ssl/key.pem"),
        cert: fs.readFileSync("ssl/cert.pem"),
      }
    : false;

module.exports = {
  // ... existing config ...

  devServer: {
    static: {
      directory: path.join(__dirname, "public"),
    },
    compress: true,
    port: 3000,
    hot: true,
    open: true,

    // ✅ Enable HTTPS
    server: sslOptions ? "https" : "http",
    ...(sslOptions && { https: sslOptions }),

    // ✅ Proxy API requests to backend
    proxy: {
      "/api": {
        target: useHttps ? "https://localhost:4000" : "http://localhost:4000",
        secure: false, // Allow self-signed certs
        changeOrigin: true,
      },
      "/auth": {
        target: useHttps ? "https://localhost:4000" : "http://localhost:4000",
        secure: false,
        changeOrigin: true,
      },
    },

    // ✅ Handle history API fallback
    historyApiFallback: true,
  },
};
```

---

### Step 3: Configure Express Backend for HTTPS

Update `packages/app/src/index.ts` (or wherever your Express server starts):

```ts
// packages/app/src/index.ts
import express from "express";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import cors from "cors";
import mongoose from "mongoose";

// ... your existing imports ...

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// ... your routes ...

// ✅ HTTPS Setup
const useHttps = process.env.HTTPS === "true";
let server: http.Server | https.Server;

if (useHttps) {
  const sslPath = path.join(__dirname, "../../ssl");
  const certPath = path.join(sslPath, "cert.pem");
  const keyPath = path.join(sslPath, "key.pem");

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    server = https.createServer(httpsOptions, app);
    console.log(`🔐 HTTPS server running on https://localhost:${PORT}`);
  } else {
    console.warn("⚠️ HTTPS enabled but certs not found. Falling back to HTTP.");
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
  console.log(`🚀 HTTP server running on http://localhost:${PORT}`);
}

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/demo")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Start server
server.listen(PORT, () => {
  console.log(`📦 Service: ${process.env.SERVICE_NAME || "Lerna Mono Demo"}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});
```

---

### Step 4: Update Environment Variables

Create/update `.env` files:

#### `packages/web/.env.development`

```env
# Frontend
HTTPS=true
PORT=3000
REACT_APP_API_URL=https://localhost:4000
```

#### `packages/app/.env.development`

```env
# Backend
HTTPS=true
PORT=4000
MONGODB_URI=mongodb://localhost:27017/demo
SERVICE_NAME=Lerna Mono Demo (React 19)
NODE_ENV=development
```

---

### Step 5: Update Package Scripts

Update `packages/web/package.json`:

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "dev": "webpack serve --mode development --open",
    "dev:https": "cross-env HTTPS=true webpack serve --mode development --open",
    "build": "webpack --mode production",
    "generate-cert": "bash scripts/generate-cert.sh"
  }
}
```

Update `packages/app/package.json`:

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "dev": "cross-env NODE_ENV=development ts-node-dev src/index.ts",
    "dev:https": "cross-env NODE_ENV=development HTTPS=true ts-node-dev src/index.ts",
    "build": "tsc",
    "generate-cert": "bash scripts/generate-cert.sh"
  }
}
```

> 💡 Install `cross-env` if not already present:
>
> ```bash
> npm install -D cross-env
> ```

---

### Step 6: Update Root Scripts (Optional)

Update root `package.json` for convenience:

```json
{
  "scripts": {
    "start": "lerna run start --parallel",
    "start:https": "cross-env HTTPS=true lerna run start --parallel",
    "dev": "lerna run dev --parallel",
    "dev:https": "cross-env HTTPS=true lerna run dev --parallel",
    "generate-certs": "lerna run generate-cert --scope=@demo/web --scope=@demo/app"
  }
}
```

---

### Step 7: Trust the Self-Signed Certificate (Browser)

When you first visit `https://localhost:3000`, your browser will show a security warning.

#### Chrome/Edge

1. Click "Advanced" → "Proceed to localhost (unsafe)"
2. Or install the cert permanently:
   - Click the lock icon → "Certificate" → "Details" → "Export"
   - Import into your OS trust store

#### Firefox

1. Click "Advanced" → "Accept the Risk and Continue"
2. Or go to `about:preferences#privacy` → "View Certificates" → "Import"

#### macOS (Keychain)

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain packages/web/ssl/cert.pem
```

#### Windows

1. Right-click `cert.pem` → "Install Certificate"
2. Choose "Local Machine" → "Place all certificates in the following store"
3. Browse to "Trusted Root Certification Authorities" → Finish

---

### Step 8: Update Playwright E2E Tests for HTTPS

Update `playwright.config.ts`:

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

const useHttps = process.env.HTTPS === "true";
const baseURL = useHttps ? "https://localhost:3000" : "http://localhost:3000";
const apiBase = useHttps ? "https://localhost:4000" : "http://localhost:4000";

export default defineConfig({
  webServer: {
    command: useHttps ? "npm run start:https" : "npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  use: {
    baseURL,
    ignoreHTTPSErrors: true, // ✅ Allow self-signed certs in tests
    trace: "on-first-retry",
  },

  // ... rest of config
});
```

Update your API health test to use the correct protocol:

```ts
// e2e/app.spec.ts
test("API health check works", async ({ request }) => {
  const apiBase =
    process.env.HTTPS === "true"
      ? "https://localhost:4000"
      : "http://localhost:4000";

  const response = await request.get(`${apiBase}/health`);
  expect(response.status()).toBe(200);
  // ... rest of test
});
```

---

### Step 9: Update Documentation

Update your markdown docs with HTTPS URLs:

```markdown
### Access Points (HTTPS Enabled)

| Service     | URL                               |
| ----------- | --------------------------------- |
| Frontend    | `<https://localhost:3000>`        |
| Backend API | `<https://localhost:4000>`        |
| API Health  | `<https://localhost:4000/health>` |

> 🔐 Using self-signed certificates. You may need to accept the browser warning or install the cert.
```

---

## 🧪 Test Your HTTPS Setup

```bash
# Generate certificates
npm run generate-certs

# Start with HTTPS
npm run dev:https

# Or start individually:
cd packages/web && npm run dev:https
cd packages/app && npm run dev:https
```

✅ **Verify**:

- [ ] Frontend loads at `https://localhost:3000`
- [ ] Backend API responds at `https://localhost:4000/health`
- [ ] Login flow works over HTTPS
- [ ] API proxy forwards requests correctly
- [ ] E2E tests pass with `ignoreHTTPSErrors: true`

---

## 🌐 Production HTTPS (Brief Overview)

For production, **don't use self-signed certs**. Instead:

### Option A: Reverse Proxy (Recommended)

```bash
Internet → Nginx/Caddy (HTTPS + Let's Encrypt) → Your App (HTTP internally)
```

**Nginx example**:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000; # Frontend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:4000; # Backend
        proxy_set_header Host $host;
    }
}
```

### Option B: Direct HTTPS in Express (Advanced)

```ts
// Production: Use real certs from Let's Encrypt
const httpsOptions = {
  key: fs.readFileSync("/etc/letsencrypt/live/yourdomain.com/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/yourdomain.com/fullchain.pem"),
};
https.createServer(httpsOptions, app).listen(443);
```

### Option C: Platform-Managed HTTPS

- ✅ Vercel, Netlify, Render, Railway: Auto HTTPS
- ✅ AWS ALB + ACM: Managed certificates
- ✅ Cloudflare: Flexible/Full SSL

---

## 🛠️ Troubleshooting

| Issue                             | Solution                                                                 |
| --------------------------------- | ------------------------------------------------------------------------ |
| ❌ "Certificate not trusted"      | Install cert in OS trust store or use `ignoreHTTPSErrors: true` in tests |
| ❌ "Mixed content" warning        | Ensure all API calls use `https://` when frontend is HTTPS               |
| ❌ Webpack proxy fails            | Set `secure: false` for self-signed certs                                |
| ❌ Backend won't start with HTTPS | Verify cert paths and file permissions                                   |
| ❌ CORS errors over HTTPS         | Ensure backend CORS allows `https://localhost:3000`                      |

---

## 📦 Certificate Management Tips

### Auto-renew for Development

```bash
# Add to root package.json
{
  "scripts": {
    "cert:renew": "openssl req -x509 -newkey rsa:4096 -keyout packages/web/ssl/key.pem -out packages/web/ssl/cert.pem -days 365 -nodes -subj '/CN=localhost' -passin pass:"
  }
}
```

### Share Certs Across Packages

```bash
packages/
├── common/
│   └── ssl/          # Shared certs
│       ├── cert.pem
│       └── key.pem
├── web/
│   └── ssl -> ../common/ssl  # Symlink
└── app/
    └── ssl -> ../common/ssl  # Symlink
```

---

## ✅ Final Checklist

- [ ] Self-signed certificates generated
- [ ] Webpack configured for HTTPS + proxy
- [ ] Express configured for HTTPS
- [ ] Environment variables set (`HTTPS=true`)
- [ ] Package scripts updated (`dev:https`, `start:https`)
- [ ] Browser trusts the certificate (or warning accepted)
- [ ] Playwright tests updated with `ignoreHTTPSErrors: true`
- [ ] Documentation updated with HTTPS URLs
- [ ] Mixed content issues resolved (all URLs use `https://`)

---

## 🎉 You're Done

Your app now supports HTTPS in development! 🔐

```bash
✅ Frontend: https://localhost:3000
✅ Backend:  https://localhost:4000
✅ API:      https://localhost:4000/health
✅ Tests:    Running with HTTPS + self-signed certs
```

---

### 🔜 Next Steps (Optional)

- [ ] Add HTTP/2 support for performance
- [ ] Configure HSTS headers for production
- [ ] Set up automated Let's Encrypt renewal
- [ ] Add certificate pinning for mobile apps
- [ ] Implement mutual TLS (mTLS) for API security

---

**Need help with production deployment?** Let me know your hosting platform (Vercel, AWS, Docker, etc.) and I'll provide specific HTTPS setup instructions! 🚀✨
