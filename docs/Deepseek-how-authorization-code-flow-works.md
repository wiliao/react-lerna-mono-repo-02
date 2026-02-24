# How OAuth 2 works

## How does OAuth 2.0 provider authenticate user and then send back authorization code to user and then exchange authorization code with access token and send back to user?

In OAuth 2.0, the **Authorization Code Flow** is the most common method for web applications to obtain access tokens on behalf of a user. Here’s how an OAuth 2.0 provider handles user authentication, issues an authorization code, and exchanges it for an access token.

---

### 1. **User Authentication (at the Provider)**

- The user attempts to log in via a client application (e.g., a website or mobile app).
- The client redirects the user to the OAuth provider’s **authorization endpoint** with parameters like:
  - `response_type=code` (indicating the Authorization Code flow)
  - `client_id` (identifies the client)
  - `redirect_uri` (where the provider sends the user after authentication)
  - `scope` (requested permissions)
  - `state` (a CSRF token)
- The provider displays a login page (if the user isn’t already authenticated). The user enters their credentials, and the provider validates them.  
  **Note:** Authentication may also include multi-factor authentication (MFA) if configured.
- After successful authentication, the provider often shows a consent screen asking the user to grant the requested permissions to the client.

---

### 2. **Issuance of the Authorization Code**

- Once the user authenticates and grants consent, the provider generates a short-lived **authorization code**.
- The provider redirects the user’s browser back to the client’s `redirect_uri`, appending the code and the original `state` parameter as query parameters:  
  `https://client.example.com/callback?code=AUTHORIZATION_CODE&state=...`
- The user never sees the code directly; it’s passed through the browser as part of the URL. The client application (usually running on a web server) extracts the code from the incoming request.

---

### 3. **Exchanging the Authorization Code for an Access Token**

- The client (now acting as a confidential client, with its own `client_id` and `client_secret`) makes a **back-channel** HTTP POST request to the provider’s **token endpoint**.
- The request includes:
  - `grant_type=authorization_code`
  - `code` (the authorization code received)
  - `redirect_uri` (must match the one used in the initial request)
  - `client_id` and `client_secret` (authenticating the client)
- The provider validates:
  - The authorization code (it must be valid, not expired, and not used before)
  - The client credentials
  - That the `redirect_uri` matches the original
- If everything checks out, the provider responds with a JSON object containing:
  - `access_token` (the token used to access resources)
  - `token_type` (usually "Bearer")
  - `expires_in` (lifetime in seconds)
  - Optionally a `refresh_token` (if requested and allowed)

---

### 4. **Delivery of the Access Token to the Client (Not Directly to the User)**

- The access token is sent **only to the client application** (server-side or secure app storage). The user does not see it.
- The client can now use the access token to make authenticated API requests to the resource server on behalf of the user.
- If the client is a native or single-page application, the **PKCE extension** is often used to enhance security, but the core exchange logic remains similar.

---

### Summary of the Flow (Provider’s Perspective)

| Step | Provider Action                                                         |
| ---- | ----------------------------------------------------------------------- |
| 1    | Authenticates user via login form / session.                            |
| 2    | Generates and returns an authorization code via redirect.               |
| 3    | Receives code + client credentials, validates, and issues access token. |
| 4    | Returns access token (and optional refresh token) to the client.        |

The user’s browser is only involved in the first two steps (authentication and code delivery). The token exchange happens server‑to‑server, keeping the access token secure from exposure in the browser.

## If my app is SPA or mobile app, what happen?

For **Single‑Page Applications (SPAs)** and **mobile/native apps**, the OAuth 2.0 flow must adapt to their **public client** nature—they cannot securely store a client secret. The modern, recommended approach is the **Authorization Code Flow with PKCE** (Proof Key for Code Exchange). Here’s how it works in these environments.

---

### 1. **User Authentication (Provider)**

- The app opens the provider’s authorization endpoint in an external browser (or an in‑app browser tab like Chrome Custom Tabs / ASWebAuthenticationSession on mobile).
- Parameters include:
  - `response_type=code`
  - `client_id`
  - `redirect_uri` (custom URI scheme for mobile, or `https` for SPA)
  - `scope`
  - `state` (CSRF protection)
  - **`code_challenge`** and **`code_challenge_method`** (explained below)
- The provider authenticates the user and asks for consent, just like in the standard flow.

---

### 2. **Issuance of the Authorization Code**

- After authentication, the provider redirects the user back to the app via the `redirect_uri`. The URL contains the authorization code (and `state`).
- The app extracts the code from the URL (handled via JavaScript in SPA, or via custom URI handling in mobile).

---

### 3. **Exchanging the Code for an Access Token (with PKCE)**

- The app now makes a **back‑channel request** to the provider’s token endpoint. Because it’s a public client, it **does not** send a client secret. Instead, it includes:
  - `grant_type=authorization_code`
  - `code` (the authorization code)
  - `redirect_uri` (must match the initial request)
  - `client_id`
  - **`code_verifier`** (the plaintext version of the previously hashed `code_challenge`)
- The provider validates:
  - The authorization code (valid, not expired, not reused)
  - That the `code_verifier` matches the `code_challenge` sent earlier (cryptographic binding)
  - The `redirect_uri`
- If valid, the provider responds with an `access_token`, `token_type`, `expires_in`, and optionally a `refresh_token`.

---

### 4. **Token Storage and Usage**

- **SPA**: The tokens are typically stored **in memory** (JavaScript variables) to avoid exposure in localStorage/sessionStorage, which are vulnerable to XSS. If a refresh token is issued, it must be handled very carefully—often the backend (if any) or secure storage is used. Some providers issue short‑lived access tokens and rely on silent authentication (via an iframe) to obtain new ones.
- **Mobile**: The tokens are stored in **secure device storage** (e.g., Keychain on iOS, Keystore on Android). Refresh tokens can be stored alongside access tokens and used to obtain new access tokens without user interaction.

---

### Why Not Implicit Flow?

- Historically, SPAs used the **Implicit Flow** (`response_type=token`), which returned the access token directly in the redirect URL. This exposed the token in the browser history and was less secure.
- The Authorization Code with PKCE is now the **OAuth 2.1 recommended standard** for all public clients because it keeps the token exchange out of the browser and adds cryptographic binding.

---

### Summary for Public Clients

| Step | What Happens Differently                                                           |
| ---- | ---------------------------------------------------------------------------------- |
| 1    | App generates a `code_verifier` and sends its hash (`code_challenge`) during auth. |
| 2    | Code is returned via redirect, same as before.                                     |
| 3    | Token exchange uses `code_verifier` (no client secret). Provider verifies match.   |
| 4    | Token is stored securely in memory (SPA) or device keystore (mobile).              |

This flow ensures that even if the authorization code is intercepted, it cannot be exchanged without the `code_verifier`, which never leaves the app.

## Use Case: user login to JSP web app, and SPA is rendered by server side JSP dynamically, SPA does not login anymore, how to pass access token (JWT) to SPA?

When your **JSP‑based server‑side application** renders a **Single‑Page Application (SPA)** dynamically, and the user is already authenticated via the JSP (using a traditional session cookie), you need to make the **access token (JWT)** available to the SPA so it can call APIs that require it. However, the SPA does not perform a separate OAuth login—it inherits the authentication from the JSP session.

Below are several strategies to securely pass the token to the SPA, along with their trade‑offs and security considerations.

---

### 1. **Embed the Token in the Initial HTML** (Simple, but XSS‑vulnerable)

- **How it works:**  
  When the JSP renders the page that hosts the SPA, it injects the JWT into a JavaScript variable or a `<meta>` tag.
  ```jsp
  <script>
    window.accessToken = '<%= accessToken %>';
  </script>
  ```
- **Pros:**  
  – Extremely simple to implement.  
  – Works immediately – the SPA can read `window.accessToken` as soon as it loads.
- **Cons:**  
  – The token is exposed in the HTML source and can be stolen by any **XSS vulnerability** in the SPA.  
  – The token may also appear in server logs or browser history (if the URL is bookmarked, the token is not in the URL, so that part is safe).

---

### 2. **Use an HttpOnly Cookie** (Secure, but token not directly readable by JavaScript)

- **How it works:**  
  The JSP backend sets a secure, HttpOnly cookie containing the JWT (or a session identifier linked to the token).
  ```jsp
  Cookie tokenCookie = new Cookie("access_token", accessToken);
  tokenCookie.setHttpOnly(true);
  tokenCookie.setSecure(true);
  tokenCookie.setPath("/");
  response.addCookie(tokenCookie);
  ```
- **Pros:**  
  – The cookie is not accessible via JavaScript, protecting it from XSS.  
  – It is automatically sent with every request to the same domain, so the API can authenticate using the cookie (if the API accepts cookies).
- **Cons:**  
  – The SPA **cannot read the token value** to set an `Authorization: Bearer` header manually.  
  – This approach only works if your backend API can accept cookie‑based authentication. If the API expects a Bearer token, you would need to modify it.

---

### 3. **Fetch the Token from a Secure Endpoint at Runtime** (Recommended)

- **How it works:**  
  The JSP backend exposes a protected endpoint (e.g., `/api/token`) that returns the JWT for the currently authenticated session.
  - The endpoint checks the existing session cookie and, if valid, responds with the token in JSON.
  - After the SPA loads, it makes an AJAX request (e.g., `fetch('/api/token')`) to retrieve the token and stores it **in memory** (a JavaScript variable).
  - Subsequent API calls include the token in the `Authorization` header.
- **Pros:**  
  – The token is **never embedded in the HTML**, reducing exposure.  
  – The session cookie protects the token endpoint (no need for client secrets).  
  – The SPA can control token usage and refresh logic.
- **Cons:**  
  – Adds an extra round‑trip after page load.  
  – The token still lives in memory, so it could be stolen by an XSS attack (but this is true for any in‑memory token).

**Implementation sketch:**

```jsp
<!-- JSP: no token embedded -->
<div id="app"></div>
<script src="spa.js"></script>
```

```javascript
// spa.js
async function init() {
  const resp = await fetch("/api/token", { credentials: "same-origin" });
  const { accessToken } = await resp.json();
  // store in memory (e.g., a closure variable)
  api.setToken(accessToken);
}
init();
```

---

### 4. **Server‑Side Proxy Pattern** (Token never leaves the server)

- **How it works:**  
  Instead of passing the token to the SPA, you make the SPA call your own backend (same origin) for all API requests. Your backend then attaches the JWT (which it holds in the session) to the request to the actual resource server.
- **Pros:**  
  – The token is **never exposed to the browser** – maximum security against XSS.  
  – The backend can enforce additional checks, logging, or transformation.
- **Cons:**  
  – Adds a hop (increased latency).  
  – Requires writing and maintaining proxy endpoints.  
  – Not suitable if the SPA needs to call third‑party APIs directly (though you could proxy those too).

---

### 5. **Hybrid: Short‑Lived Token + Refresh** (Advanced)

- Combine option 3 with refresh tokens.  
  The SPA fetches a short‑lived access token from the `/api/token` endpoint. When it expires, it calls a `/api/refresh` endpoint (protected by session cookie) to obtain a new one. This keeps the access token window small while avoiding long‑lived tokens in memory.

---

### **Security Considerations**

- **XSS remains the biggest threat** for any token accessible to JavaScript. Use a strong Content Security Policy (CSP) and sanitize user inputs to mitigate XSS.
- **CSRF** is less of a concern if you use SameSite cookies and/or anti‑CSRF tokens, especially because the SPA is on the same origin.
- **Token storage in memory** (not `localStorage`/`sessionStorage`) is preferred for SPAs because those storages are persistent and more easily stolen via XSS.
- **HTTPS is mandatory** for all communications.

---

### **Recommendation**

- If your backend API can accept cookies for authentication, **option 2** is the simplest and most secure (just use the existing session cookie).
- If you must provide a Bearer token to the SPA (e.g., to call external APIs), **option 3** (fetch token at runtime) offers a good balance between security and practicality.
- For maximum security in a sensitive application, **option 4** (backend proxy) keeps the token completely out of the client.

Choose based on your API requirements, your tolerance for extra network calls, and your security posture.
