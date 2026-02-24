# How OAuth 2 works

## how does OAuth 2.0 provider authenticate user and then send back authorization code to user and then exchange authorization code with access token and send back to user?

## OAuth 2.0 Authorization Code Flow

Here's how the full flow works step by step:

---

### 1. User Initiates Login

The user clicks "Login with Google" (or similar) on your app (the **Client**). The client redirects the user's browser to the **Authorization Server** with a URL like:

```
https://auth.provider.com/authorize?
  response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &scope=openid email profile
  &state=random_csrf_token
```

---

### 2. Authorization Server Authenticates the User

The provider (e.g., Google) receives the request and presents its own **login page** to the user. The user enters credentials directly on the provider's page — your app **never sees the password**. The provider may also show a consent screen ("Allow this app to access your email?").

---

### 3. Provider Sends Back the Authorization Code

After successful login, the Authorization Server **redirects the user's browser** back to your `redirect_uri` with a short-lived authorization code:

```
https://yourapp.com/callback?code=AUTH_CODE_HERE&state=random_csrf_token
```

- The `state` param is validated by your app to prevent CSRF attacks.
- The **code is short-lived** (usually 5–10 minutes) and single-use.
- This happens via the browser, so it's a **front-channel** exchange (less secure, hence why we don't send the token here).

---

### 4. Client Exchanges Code for Access Token (Back-Channel)

Your server now makes a **direct server-to-server HTTP POST** (not through the browser) to the token endpoint:

```http
POST https://auth.provider.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTH_CODE_HERE
&redirect_uri=https://yourapp.com/callback
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
```

The `client_secret` proves your app's identity. Because this happens **server-to-server**, the secret and token are never exposed to the browser.

---

### 5. Authorization Server Returns the Access Token

The provider validates the code + secret and responds with:

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "some_refresh_token",
  "id_token": "eyJ..."
}
```

---

### 6. Client Uses the Access Token

Your app stores the token (server-side) and uses it to call protected APIs on behalf of the user:

```http
GET https://api.provider.com/userinfo
Authorization: Bearer eyJhbGciOi...
```

---

### Why the Two-Step (Code → Token)?

This is the key design insight. The authorization code travels through the **browser (front-channel)** which is less secure (visible in URLs, logs, browser history). By exchanging it for a token via a **direct server-to-server call (back-channel)** using a `client_secret`, the actual access token is never exposed to the browser. The code alone is useless without the secret.

---

### Visual Summary

```
User → Client: "Login"
Client → Browser redirect → Auth Server: "Here's my client_id, scope"
Auth Server → User: "Enter credentials"
User → Auth Server: credentials
Auth Server → Browser redirect → Client: "Here's your code"
Client → Auth Server (server-to-server): "code + client_secret"
Auth Server → Client: "Here's your access_token"
Client → Resource API: "Bearer access_token"
```

## How 3. Provider Sends Back the Authorization Code works?

## How the Authorization Code Gets Back to Your App

This step uses a plain **HTTP redirect** through the user's browser. Here's the mechanics:

---

### What the Authorization Server Does

After the user logs in successfully, the Authorization Server returns an **HTTP 302 response** to the browser:

```http
HTTP/1.1 302 Found
Location: https://yourapp.com/callback?code=AUTH_CODE_HERE&state=random_csrf_token
```

That's it. It's just a redirect. The browser automatically follows it.

---

### Why Through the Browser?

The Authorization Server **only knows the redirect_uri** you gave it in step 1. It has no direct connection to your server — it can only talk back through the user's browser, which is the middleman connecting everything.

The flow looks like this:

```
Auth Server
    |
    | HTTP 302 → Location: https://yourapp.com/callback?code=...
    ↓
User's Browser        ← browser automatically follows the redirect
    |
    | GET https://yourapp.com/callback?code=AUTH_CODE_HERE&state=xyz
    ↓
Your App Server       ← your server receives the code in the query string
```

---

### What Your App Server Receives

Your `/callback` endpoint gets a normal GET request:

```http
GET /callback?code=AUTH_CODE_HERE&state=random_csrf_token HTTP/1.1
Host: yourapp.com
```

Your server picks `code` out of the query string and moves on to the token exchange.

---

### Security Considerations at This Step

**Why not send the token here directly?**
The code travels through the browser's address bar — it's visible in browser history, server logs, and referrer headers. A raw access token here would be dangerous. The short-lived, single-use code is designed to be "safe enough" for this exposure because it's useless without the `client_secret`.

**The `redirect_uri` must match exactly.**
The Authorization Server checks that the `redirect_uri` in your initial request matches what you registered when setting up your app. If they don't match, it rejects the request — this prevents an attacker from hijacking the code by changing the redirect destination.

**The `state` param prevents CSRF.**
Your app generated a random `state` value in step 1 and stored it in the session. When the callback arrives, your app checks that the `state` in the URL matches what it stored. If an attacker tried to trick a user into completing a fake auth flow, the `state` wouldn't match and your app would reject it.

---

### In Short

It's not a fancy protocol — it's just the Authorization Server telling the browser "go to this URL now," and the browser obediently making a GET request to your app with the code in the URL. The cleverness is in what you _don't_ put in that URL (the actual token) and the guards (`redirect_uri` validation + `state`) that prevent tampering.

## If my app is SPA or mobile app, what happen?

Great question! SPAs and mobile apps can't safely store a `client_secret` (it's embedded in frontend code or a mobile binary that anyone can inspect). This changes things significantly.

---

## The Problem: No Client Secret

In a traditional server-side app, the `client_secret` is stored safely on the server. But in a SPA or mobile app:

- JavaScript code is fully readable by anyone in the browser
- Mobile app binaries can be decompiled
- There's **nowhere safe to hide a secret**

These are called **Public Clients** (vs. server apps which are **Confidential Clients**).

---

## The Solution: PKCE (Proof Key for Code Exchange)

Pronounced "pixy." PKCE replaces the `client_secret` with a **dynamically generated one-time secret** that's created fresh for each login attempt. Since it's not stored anywhere, it can't be stolen.

---

### How PKCE Works

**Before redirecting to the Auth Server, your app:**

1. Generates a random string called the **`code_verifier`** (e.g. 64 random bytes)
2. Hashes it with SHA-256 → this is the **`code_challenge`**
3. Stores the `code_verifier` in memory (not localStorage, not anywhere persistent)

```
code_verifier  = "random_string_abc123..."
code_challenge = BASE64URL(SHA256(code_verifier))
```

---

**Step 1 — Redirect to Auth Server (sends the challenge, not the verifier):**

```
https://auth.provider.com/authorize?
  response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &scope=openid email
  &state=random_state
  &code_challenge=BASE64URL_HASH_HERE
  &code_challenge_method=S256
```

The Auth Server stores the `code_challenge` tied to this auth session.

---

**Step 2 — Auth Server sends back the code** (same as before, via redirect):

```
https://yourapp.com/callback?code=AUTH_CODE_HERE&state=...
```

---

**Step 3 — Token exchange (sends the verifier, not the challenge):**

```http
POST https://auth.provider.com/token

grant_type=authorization_code
&code=AUTH_CODE_HERE
&redirect_uri=https://yourapp.com/callback
&client_id=YOUR_CLIENT_ID
&code_verifier=random_string_abc123...   ← no client_secret!
```

The Auth Server hashes the `code_verifier` with SHA-256 and checks it matches the `code_challenge` it stored earlier. If yes → issues the token.

---

### Why This Is Secure

An attacker might intercept the `code` from the redirect URL. But they can't exchange it for a token because they don't have the `code_verifier` — it only ever existed in your app's memory and was never transmitted until the token exchange. Even if they intercept the token request, the `code_verifier` is useless after one use.

```
Attacker sees:    code_challenge (safe, it's a hash)
Attacker sees:    AUTH_CODE (dangerous, but useless alone)
Attacker needs:   code_verifier ← never exposed, lives only in app memory
```

---

## SPA vs Mobile — Small Differences

**SPA:**

- Token exchange happens from the browser directly to the Auth Server (CORS must be allowed)
- Access token stored in memory (not localStorage — XSS risk)
- Refresh tokens are risky in SPAs; some providers use **silent refresh** (hidden iframe) or short-lived tokens instead

**Mobile:**

- Uses a system browser or in-app browser tab (not a WebView — WebViews let the app snoop on credentials)
- The redirect URI uses a **custom URL scheme** (`myapp://callback`) or **Universal Links** so the OS routes the callback back to your app
- Refresh tokens are safer here since the OS provides better app sandboxing

---

## Summary

|                | Server-Side App          | SPA / Mobile                           |
| -------------- | ------------------------ | -------------------------------------- |
| Client type    | Confidential             | Public                                 |
| Secret         | `client_secret` (static) | PKCE `code_verifier` (dynamic)         |
| Token storage  | Server session           | Memory (SPA) / Secure storage (mobile) |
| Token exchange | Server → Auth Server     | Browser/App → Auth Server              |

PKCE is now recommended for **all** OAuth flows, even server-side apps, as an extra layer of defense.

## Use Case: user login to JSP web app, and SPA is rendered by server side JSP dynamically, SPA does not login anymore, how to pass access token (JWT) to SPA?

Great use case! This is a common hybrid architecture. The JSP server handles authentication, and you need to securely hand off the token to the SPA it renders.

---

## The Situation

```
User → JSP Server (handles OAuth login, holds access token)
JSP Server → renders HTML page → SPA boots up in browser
SPA needs the token → but how does it get it?
```

---

## Options to Pass the Token

### Option 1: Embed in the HTML Page (Most Common)

When JSP renders the page, it injects the token directly into the HTML:

```html
<!-- JSP renders this -->
<script>
  window.__APP_CONFIG__ = {
    accessToken: "${accessToken}",
  };
</script>

<!-- then your SPA bundle loads -->
<script src="/app.js"></script>
```

Your SPA reads it at startup:

```javascript
const token = window.__APP_CONFIG__.accessToken;
// use it for API calls, then delete it from window
delete window.__APP_CONFIG__;
```

**Pros:** Simple, no extra network call.  
**Cons:** Token is briefly on the `window` object (XSS risk if other scripts run before you delete it). Also appears in page source.

---

### Option 2: HttpOnly Cookie (Most Secure)

After login, the JSP server sets the token as an **HttpOnly cookie**:

```java
Cookie tokenCookie = new Cookie("access_token", accessToken);
tokenCookie.setHttpOnly(true);   // JS cannot read this
tokenCookie.setSecure(true);     // HTTPS only
tokenCookie.setPath("/");
response.addCookie(tokenCookie);
```

The SPA **never reads the token directly** — it just makes API calls and the browser automatically attaches the cookie. Your backend validates the cookie on each request.

```javascript
// SPA just makes requests, cookie is sent automatically
fetch("/api/userdata", {
  credentials: "include", // ensures cookies are sent
});
```

**Pros:** Token never accessible to JavaScript at all — XSS safe.  
**Cons:** Vulnerable to CSRF (mitigate with `SameSite=Strict` or CSRF tokens). Also, if your API is on a different domain, cookies won't work cross-origin without extra config.

---

### Option 3: SPA Calls a Dedicated `/me` or `/token` Endpoint

JSP server stores the token in the **server-side session**. The SPA makes an authenticated request to fetch it:

```javascript
// SPA on boot:
const res = await fetch("/api/session/token", {
  credentials: "include", // sends session cookie
});
const { accessToken } = await res.json();
```

JSP backend returns the token only if the session is valid:

```java
@GetMapping("/api/session/token")
public ResponseEntity<?> getToken(HttpSession session) {
    String token = (String) session.getAttribute("access_token");
    if (token == null) return ResponseEntity.status(401).build();
    return ResponseEntity.ok(Map.of("accessToken", token));
}
```

**Pros:** Clean separation, token not in page source.  
**Cons:** Extra network round-trip on SPA boot.

---

## Recommended Approach for Your Use Case

Since JSP already controls the page render, **Option 1 + Option 2 combined** is practical:

```
JSP handles OAuth → stores token in HttpOnly cookie → renders SPA
SPA makes API calls → cookie sent automatically → backend validates
```

The SPA never needs to "know" the token at all — the cookie does the work invisibly. This is the most secure pattern.

If you **need** the SPA to have the raw token (e.g., to call a third-party API directly from the browser), use **Option 1** but treat the token carefully — read it immediately, store it only in a JS variable (not localStorage), and wipe it from `window`.

---

## What to Avoid

| Approach                                                    | Why to Avoid                                    |
| ----------------------------------------------------------- | ----------------------------------------------- |
| `localStorage`                                              | Persists forever, readable by any JS (XSS risk) |
| `sessionStorage`                                            | Slightly better but still XSS readable          |
| URL query param (`?token=...`)                              | Appears in browser history and server logs      |
| Passing via `postMessage` across origins without validation | Open to message spoofing                        |
