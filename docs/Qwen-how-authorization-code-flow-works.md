# How OAuth 2.x works

## How does OAuth 2.0 provider authenticate user and then send back authorization code to user and then exchange authorization code with access token and send back to user?

This process describes the **OAuth 2.0 Authorization Code Flow**. It is the most common and secure flow for web applications and mobile apps.

It is important to clarify a distinction in terminology:

- **The User:** The human being.
- **The Client:** The application (website or mobile app) the user is trying to access.
- **The Authorization Server (Provider):** The service handling the login (e.g., Google, Facebook, Auth0).

Here is the step-by-step breakdown of how the authentication, code delivery, and token exchange work.

---

### The Actors

1.  **Resource Owner:** The User.
2.  **Client:** Your Application.
3.  **Authorization Server:** The OAuth Provider (e.g., Google).
4.  **Resource Server:** The API holding the user's data (often the same entity as the Authorization Server).

---

### Step 1: User Authentication (At the Provider)

The process begins when the User clicks "Login with Provider" on your Client application.

1.  **Redirect:** The Client redirects the User's browser to the **Authorization Server**.
    - The URL includes parameters: `client_id`, `redirect_uri`, `scope` (what data you want), `response_type=code`, and a `state` string (for security).
2.  **Login Screen:** The Authorization Server checks if the User has an active session.
    - **If no session:** The Provider presents a login screen (Username/Password, MFA, Biometric). **This is how the Provider authenticates the user.** The Client _never_ sees the user's password.
    - **If session exists:** The Provider skips the login screen.
3.  **Consent:** Once authenticated, the Provider asks the User: _"Do you allow [Client App] to access your [Email/Profile]?"_
4.  **Approval:** The User clicks "Allow."

### Step 2: Sending the Authorization Code (To the Client)

Once the User approves, the Provider needs to tell the Client that it is okay to proceed, but it doesn't send the Access Token yet.

1.  **Redirect Back:** The Authorization Server redirects the User's browser back to the `redirect_uri` specified by the Client in Step 1.
2.  **The Code:** Attached to this redirect URL is the **Authorization Code**.
    - Example: `https://your-app.com/callback?code=AUTH_CODE_123&state=XYZ`
3.  **Security Check:** The Client verifies that the `state` parameter matches what it sent in Step 1 (to prevent Cross-Site Request Forgery attacks).
4.  **Note:** The User's browser handles this redirect. The User sees the URL change, but the **Client Application** (specifically the backend server) captures the `code` from the URL.

### Step 3: Exchanging Code for Access Token

Now the Client must trade the temporary code for the actual key (Access Token). **This step happens server-to-server, not in the browser.**

1.  **Backend Request:** Your Client's backend server sends a `POST` request directly to the Authorization Server's Token Endpoint.
2.  **Payload:** The request includes:
    - The `Authorization Code` received in Step 2.
    - The `client_id`.
    - The `client_secret` (A password known only to your backend and the Provider).
    - The `redirect_uri` (must match Step 1 exactly).
3.  **Validation:** The Authorization Server verifies:
    - Is the Code valid and not expired? (Codes are single-use and short-lived, usually ~10 mins).
    - Does the `client_secret` match the `client_id`?
    - Does the `redirect_uri` match the one registered for this app?

### Step 4: Sending Back the Access Token

If validation succeeds, the Authorization Server responds to your backend.

1.  **Response:** The Provider sends a JSON response containing:
    - `access_token`: The key used to access user data.
    - `token_type`: Usually "Bearer".
    - `expires_in`: How long the token lasts (e.g., 3600 seconds).
    - `refresh_token`: (Optional) Used to get new access tokens without logging in again.
2.  **Usage:** Your Client backend stores this token (usually in a session or secure database) and uses it to make API calls to the **Resource Server** on behalf of the User.
3.  **User Experience:** Your Client redirects the User to their dashboard. The User is now "logged in."

---

### Visual Sequence Diagram

```text
User            Client (App)              Authorization Server (Provider)
 |                   |                              |
 | 1. Click Login    |                              |
 |------------------>|                              |
 |                   | 2. Redirect to Auth URL      |
 |<-------------------------------------------------|
 | 3. Enter Password |                              |
 |------------------------------------------------->|
 |                   | 4. Authenticate & Consent    |
 |<-------------------------------------------------|
 |                   | 5. Redirect with CODE        |
 |<-------------------------------------------------|
 | 6. Land on Callback Page                         |
 |                   | 7. Extract Code from URL     |
 |                   | 8. POST Code + Secret        |
 |                   |------------------------------->|
 |                   | 9. Validate & Return Token   |
 |                   |<-------------------------------|
 |                   | 10. Create Session           |
 | 11. Show Dashboard|                              |
 |<------------------|                              |
```

---

### Critical Security Concepts

#### 1. Why not send the Access Token directly in Step 2?

If the Provider sent the Access Token directly in the browser redirect (Step 2), it could be intercepted by malicious browser extensions, logged in browser history, or leaked via the `Referer` header. The **Authorization Code** is useless to an attacker without the `client_secret`, which lives safely on your backend.

#### 2. PKCE (Proof Key for Code Exchange)

If your Client is a **Single Page App (React/Vue)** or a **Mobile App**, you cannot safely store a `client_secret`.

- In this scenario, you use **OAuth 2.1 / PKCE**.
- The Client creates a random `code_verifier` and sends a hashed version (`code_challenge`) in Step 1.
- In Step 3, the Client sends the plain `code_verifier` instead of a `client_secret`.
- This prevents "Authorization Code Interception Attacks."

#### 3. The `state` Parameter

In Step 1, the Client generates a random string (`state`) and saves it in the user's session. In Step 2, the Provider returns this same string. The Client must compare them. If they don't match, the request is forged, and the login should be aborted.

#### 4. HTTPS

All communication (especially Step 2 and Step 3) must happen over HTTPS. If Step 3 is done over HTTP, the `client_secret` and `access_token` could be sniffed by attackers on the network.

### Summary

1.  **Authenticate:** Provider shows login screen to User.
2.  **Code:** Provider redirects User's browser to Client with a temporary **Code**.
3.  **Exchange:** Client Backend sends **Code + Secret** to Provider.
4.  **Token:** Provider validates and returns **Access Token** to Client Backend.

## Please explain in more detail about OAuth 2.1 / PKCE for the Client is a Single Page App (React/Vue) or a Mobile App and especially there is no session for mobile app

This is a critical distinction in modern security. In the traditional web flow (Server-Side Rendering), the backend holds a `client_secret`. However, **Single Page Applications (SPAs)** and **Mobile Apps** are considered **Public Clients**.

- **SPAs:** All code runs in the browser. Any `client_secret` embedded in JavaScript can be viewed by users or attackers.
- **Mobile Apps:** The binary can be decompiled. Any `client_secret` hardcoded in the app can be extracted.

Because they cannot keep a secret, they cannot use the standard Authorization Code flow securely without an extension. That extension is **PKCE (Proof Key for Code Exchange)**, which is now the core standard in **OAuth 2.1**.

Here is the detailed breakdown of how PKCE works and how to handle state management without traditional server-side sessions.

---

### 1. The Core Concept of PKCE

PKCE prevents **Authorization Code Interception Attacks**.

- **The Attack:** An attacker intercepts the `authorization_code` sent to your redirect URI. Since you have no `client_secret` to prove identity, the attacker could send that code to the token endpoint and steal the Access Token.
- **The PKCE Solution:** The client creates a secret _on the fly_ that is never sent over the network until the very end, and only in a way that proves possession without revealing the secret prematurely.

It uses two dynamic values:

1.  **`code_verifier`:** A high-entropy random string generated by the client. **(The Key)**
2.  **`code_challenge`:** A hashed version of the verifier. **(The Lock)**

---

### 2. The PKCE Flow (Step-by-Step)

#### Step 1: Client Generates Secrets (Before Redirect)

Before redirecting the user to the login provider, your App (React/Mobile) does the following:

1.  Generate a random string: `code_verifier` (e.g., `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`).
2.  Hash that string (using SHA256) and Base64URL encode it: `code_challenge` (e.g., `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`).
3.  **Storage:** You must store the `code_verifier` temporarily (more on this in the "No Session" section below).

#### Step 2: Authorization Request

The App redirects the user to the Authorization Server.

- **URL Params:** `client_id`, `redirect_uri`, `scope`, `response_type=code`, `state`, **`code_challenge`**, `code_challenge_method=S256`.
- _Note:_ You send the **Challenge** (Lock), NOT the Verifier (Key).

#### Step 3: User Authentication

The Provider authenticates the user (same as before). The Provider stores the `code_challenge` associated with the temporary authorization session.

#### Step 4: Callback with Code

The Provider redirects the user back to your App's `redirect_uri`.

- **URL:** `myapp://callback?code=AUTH_CODE&state=STATE_VALUE`
- The App intercepts this deep link (Mobile) or route (SPA).

#### Step 5: Token Exchange (The Proof)

The App sends a `POST` request to the Token Endpoint.

- **Payload:**
  - `grant_type=authorization_code`
  - `code=AUTH_CODE`
  - `client_id`
  - **`code_verifier`** (The original random string from Step 1)
  - `redirect_uri`
- _Note:_ No `client_secret` is sent.

#### Step 6: Server Validation

The Authorization Server:

1.  Takes the received `code_verifier`.
2.  Hashes it using the same method (SHA256).
3.  Compares the result with the `code_challenge` it stored in Step 2.
4.  **If they match:** It proves the app exchanging the token is the _same_ app that started the flow. The token is issued.
5.  **If they mismatch:** The request is rejected (likely an interception attack).

---

### 3. Handling "No Session" in Mobile and SPAs

You mentioned: _"Especially there is no session for mobile app."_
It is important to distinguish between **OAuth State** (temporary) and **Application Session** (long-term).

#### A. Temporary Storage (During the OAuth Flow)

During the few seconds/minutes while the user is logging in, you need to store the `code_verifier` and `state` so you can compare them when the user returns.

- **For SPAs (React/Vue):**
  - **Mechanism:** Use `sessionStorage` or In-Memory variables.
  - **Why:** `sessionStorage` clears when the tab closes, which is secure enough for the few minutes of the login flow.
  - **Process:** Save `verifier` to `sessionStorage` -> Redirect -> Return -> Read `verifier` from `sessionStorage` -> Clear `sessionStorage`.
- **For Mobile Apps (iOS/Android):**
  - **Mechanism:** Secure Local Storage (Keychain on iOS, EncryptedSharedPreferences/Keystore on Android).
  - **Why:** When a mobile app launches an external browser (Chrome Custom Tabs / SFSafariViewController), the OS might kill your app process to save memory. If you stored the `verifier` only in RAM (variables), it will be lost.
  - **Process:** Save `verifier` to Keychain -> Launch Browser -> App Process Dies -> User Logins -> Browser opens App (Deep Link) -> App Relaunches -> Read `verifier` from Keychain -> Delete from Keychain.

#### B. Long-Term Storage (After Token Received)

Once you have the Access Token and Refresh Token, you need to manage the user's "logged in" state.

- **For SPAs:**
  - **Access Token:** Store in **Memory** (JavaScript variable). Do _not_ store in LocalStorage (vulnerable to XSS). If the page refreshes, the token is lost, and you use the Refresh Token to get a new one silently.
  - **Refresh Token:** Ideally, SPAs should not handle Refresh Tokens directly due to security risks. The best practice is the **BFF (Backend for Frontend)** pattern, where your own backend holds the refresh token in an `HttpOnly` cookie. If you must do it in the SPA, store it securely and use Rotation.
- **For Mobile Apps:**
  - **Access Token:** Store in Memory while the app is open.
  - **Refresh Token:** Store in **Secure Storage** (Keychain/Keystore). This allows the app to stay logged in for months without asking for a password, even if the app is closed completely.
  - **Session Management:** The "Session" is effectively the validity of the Refresh Token. If the Refresh Token is valid, the user is logged in.

---

### 4. Why OAuth 2.1 Makes PKCE Mandatory

In OAuth 2.0, there was a flow called the **Implicit Flow** (`response_type=token`). This returned the Access Token directly in the URL hash.

- **Problem:** The token could be leaked in browser history or server logs.
- **OAuth 2.1:** Deprecates the Implicit Flow. **All** clients (even SPAs) must use the **Authorization Code Flow with PKCE**.

### 5. Summary of Differences

| Feature                | Traditional Web App (Confidential) | SPA / Mobile (Public + PKCE)                |
| :--------------------- | :--------------------------------- | :------------------------------------------ |
| **Client Secret**      | Yes (Stored on Server)             | **No** (Cannot be kept secret)              |
| **Security Mechanism** | Client Secret Authentication       | **PKCE** (`code_verifier`/`challenge`)      |
| **Temp Storage**       | Server Session                     | `sessionStorage` (SPA) or Keychain (Mobile) |
| **Token Storage**      | Server Session / DB                | Memory (Access) + Secure Storage (Refresh)  |
| **Flow Type**          | Auth Code                          | Auth Code + PKCE                            |

### 6. Code Logic Example (Conceptual)

Here is how a Mobile App handles the "No Session" persistence logically:

```javascript
// 1. START LOGIN
async function startLogin() {
  // Generate PKCE
  const verifier = generateRandomString();
  const challenge = await sha256(verifier);

  // PERSISTENCE: Save to Secure Storage because app might be killed
  await SecureStorage.set("pkce_verifier", verifier);
  await SecureStorage.set("oauth_state", randomState);

  // Build URL
  const url = `https://auth.provider.com/authorize?
    client_id=123&
    redirect_uri=myapp://callback&
    code_challenge=${challenge}&
    code_challenge_method=S256&
    state=${randomState}`;

  // Open External Browser
  await Browser.open(url);
}

// 2. HANDLE CALLBACK (Deep Link)
async function handleCallback(url) {
  const params = parseUrl(url);
  const code = params.code;
  const state = params.state;

  // RETRIEVE PERSISTENCE: Get verifier from Secure Storage
  const storedVerifier = await SecureStorage.get("pkce_verifier");
  const storedState = await SecureStorage.get("oauth_state");

  // Security Checks
  if (state !== storedState) throw new Error("State Mismatch");
  if (!storedVerifier) throw new Error("PKCE Verifier Missing");

  // Exchange Token
  const tokens = await fetch("https://auth.provider.com/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code: code,
      code_verifier: storedVerifier, // Send the plain text verifier
      client_id: "123",
      redirect_uri: "myapp://callback",
    },
  });

  // CLEANUP: Delete temporary data
  await SecureStorage.delete("pkce_verifier");
  await SecureStorage.delete("oauth_state");

  // SAVE SESSION: Store Refresh Token securely for long term
  await SecureStorage.set("refresh_token", tokens.refresh_token);

  // Keep Access Token in Memory only
  currentAccessToken = tokens.access_token;
}
```

### Key Takeaway

For Mobile and SPAs, **PKCE replaces the Client Secret**. The "Session" during the login flow is managed by temporarily persisting the `code_verifier` in secure local storage (to survive app restarts), and the long-term "Session" is managed by securely storing the Refresh Token.
