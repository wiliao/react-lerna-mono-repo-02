# How to Add HTTPS Support

To add HTTPS support to your monorepo project (Node.js/Express backend, React frontend, shared common package, and MongoDB), you’ll need to configure SSL/TLS encryption for the web server(s) handling HTTP requests. Below is a comprehensive guide covering both development and production scenarios, with considerations for your monorepo structure.

---

## 1. Understanding Your Setup

- **`app` package**: Node.js/Express backend (API server).
- **`web` package**: React/Redux frontend (likely served by the Express server in production, but may run a separate dev server locally).
- **`common` package**: Shared utilities/libraries used by both.
- **MongoDB**: Typically runs on a separate port/protocol, so HTTPS is not directly needed for the database connection (though you may use TLS for MongoDB if required).

HTTPS can be enabled at the application level (Express) or by using a reverse proxy (Nginx, Apache) in front of your Node.js app. Both approaches are valid; we'll cover both.

---

## 2. Enabling HTTPS in Express (Backend)

### A. Generate SSL Certificates

For **development**, create a self‑signed certificate:

```bash
# Generate a private key and a self-signed certificate
openssl req -nodes -new -x509 -keyout server.key -out server.cert
```

Place these files in a secure location (e.g., `app/ssl/`). For **production**, obtain a trusted certificate from a Certificate Authority (e.g., [Let’s Encrypt](https://letsencrypt.org/) using `certbot`).

### B. Create an HTTPS Server

Modify your main server file (e.g., `app/src/index.js`) to use Node’s built‑in `https` module:

```javascript
const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");

const app = express();

// … your Express middleware, routes, etc. …

// Load SSL credentials
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, "../ssl/server.key")),
  cert: fs.readFileSync(path.join(__dirname, "../ssl/server.cert")),
};

// Create HTTPS server
const PORT = process.env.PORT || 443; // Use 443 for HTTPS in production
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`HTTPS server running on port ${PORT}`);
});
```

> **Note**: In development, you might want to keep HTTP for convenience. Use environment variables to conditionally load SSL options and switch between HTTP/HTTPS.

### C. Use Environment Variables for Flexibility

Create a configuration module (perhaps in your `common` package) that loads certificates only when needed:

```javascript
// common/src/sslConfig.js
const fs = require("fs");
const path = require("path");

function getHttpsOptions() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.USE_HTTPS === "true"
  ) {
    return {
      key: fs.readFileSync(
        process.env.SSL_KEY_PATH || path.join(process.cwd(), "ssl/server.key"),
      ),
      cert: fs.readFileSync(
        process.env.SSL_CERT_PATH ||
          path.join(process.cwd(), "ssl/server.cert"),
      ),
    };
  }
  return null; // no HTTPS options – will use HTTP
}

module.exports = { getHttpsOptions };
```

Then in your `app` server:

```javascript
const { getHttpsOptions } = require("common");
const httpsOptions = getHttpsOptions();

if (httpsOptions) {
  https.createServer(httpsOptions, app).listen(443);
} else {
  app.listen(3000);
}
```

---

## 3. Enabling HTTPS for the React Frontend

### A. If the Frontend is Served by Express

If your Express server also serves the built React static files (common in production), the HTTPS setup above already secures the frontend as well – all traffic goes through the same HTTPS server.

### B. If You Use a Separate Dev Server (Webpack Dev Server)

During development, you might run the React app with `webpack-dev-server` (or Vite). To enable HTTPS there:

- **Using environment variable**: `HTTPS=true npm start` (for Create React App).
- **Manual webpack config**:

  ```javascript
  // web/webpack.config.js (or similar)
  module.exports = {
    devServer: {
      https: true,
      // or provide your own certificate:
      https: {
        key: fs.readFileSync("./ssl/server.key"),
        cert: fs.readFileSync("./ssl/server.cert"),
      },
    },
  };
  ```

This allows you to test the React app over HTTPS locally, communicating with the backend which might also be HTTPS (watch out for CORS if they run on different ports).

---

## 4. Production Best Practices – Reverse Proxy

In production, it’s common to place a reverse proxy (Nginx, Apache, Caddy) in front of your Node.js app. The proxy handles HTTPS termination, and then forwards requests to your Express app over plain HTTP (on localhost). This simplifies certificate management and improves performance.

Example Nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000; # your Express app
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

In this setup, your Express app stays HTTP (port 3000) and trusts the proxy’s forwarded headers. You’ll need to enable `trust proxy` in Express:

```javascript
app.set("trust proxy", 1); // trust first proxy
```

Then, you can force HTTPS by redirecting all HTTP traffic to HTTPS either in Nginx or via Express middleware.

---

## 5. Handling MongoDB with TLS (Optional)

If your MongoDB instance requires TLS (e.g., MongoDB Atlas uses TLS by default), you can configure the connection string:

```bash
mongodb://user:pass@host:port/db?ssl=true
```

Or pass options in your Mongoose/Node.js driver:

```javascript
mongoose.connect(process.env.MONGO_URI, {
  ssl: true,
  sslValidate: true,
  sslCA: fs.readFileSync("./path/to/ca.pem"),
});
```

This is separate from your web server HTTPS, but can be managed in the `common` package if shared across services.

---

## 6. Shared Utilities in the `common` Package

You can centralize HTTPS‑related utilities in your `common` package, for example:

- Certificate loading logic (as shown above).
- Middleware to redirect HTTP to HTTPS.
- Functions to validate or parse HTTPS options.

This keeps your `app` and any other future services consistent.

---

## 7. Testing Your HTTPS Setup

- After starting your servers, visit `https://localhost` (or your domain) in a browser.
- For self‑signed certificates, you’ll see a security warning – proceed anyway (or add the certificate to your trusted store).
- Use `curl -v https://localhost` to inspect the SSL handshake.
- Check for mixed content errors: if your React app tries to load resources (images, API calls) over HTTP, they will be blocked. Always use relative URLs (`/api/...`) or ensure API URLs use `https:`.

---

## Summary of Steps

1. **Generate SSL certificates** (self‑signed for dev, trusted for prod).
2. **Update Express** to create an HTTPS server (or rely on a reverse proxy).
3. **If using a separate dev server**, enable HTTPS there.
4. **Consider using a reverse proxy** in production for simplicity and security.
5. **Optionally configure MongoDB TLS** if required.
6. **Refactor common logic** into the `common` package for reuse.
7. **Test thoroughly** and handle redirects/mixed content.

By following these steps, your entire monorepo (backend and frontend) will be served securely over HTTPS.
