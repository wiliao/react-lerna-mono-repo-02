# How OAuth 2 works

## How does OAuth 2.0 provider authenticate user and then send back authorization code to user and then exchange authorization code with access token and send back to user?

This is the standard **Authorization Code Grant** flow in OAuth 2.0. To understand this clearly, we need to distinguish between the **User (Resource Owner)**, the **Client Application** (the website/app trying to access data), and the **OAuth Provider** (like Google or Facebook).

Here is the step-by-step breakdown of how the authentication, code exchange, and token delivery work.

---

### The Cast of Characters

- **User:** The person trying to log in.
- **Client App:** The website the user wants to access (e.g., `myphotosite.com`).
- **Authorization Server:** The OAuth Provider's login engine (e.g., `accounts.google.com`).
- **Resource Server:** The API holding the user's data (e.g., Google Drive API).

---

### Phase 1: Authentication & The Authorization Code

_This phase happens inside the user's browser via "Redirection."_

**1. The User Clicks "Login"**
The User is on `myphotosite.com` and clicks "Login with Google."
The Client App constructs a special URL and redirects the user's browser to the Authorization Server.

- **The URL looks like this:**
  `https://accounts.google.com/authorize?response_type=code&client_id=XYZ&redirect_uri=https://myphotosite.com/callback&scope=profile`

**2. The Provider Authenticates the User**
The browser lands on the Authorization Server (Google). Because this is a redirect, the Client App never sees the user's password.

- The Authorization Server checks if the user is already logged in (via cookies).
- If not, the server presents the **Login Screen**.
- The User enters their username and password (and possibly 2FA).
- **Crucial Point:** The Provider validates the credentials against their own database. The Client App is completely unaware of this process.

**3. User Consent**
Once authenticated, the Provider asks the user: _"myphotosite.com wants to access your basic profile. Allow?"_
The User clicks "Allow."

**4. Generating and Sending the Code**
The Authorization Server generates a temporary, short-lived **Authorization Code**. It does **not** send the Access Token yet.
The Provider redirects the user's browser back to the `redirect_uri` provided in step 1, attaching the code in the query string.

- **Browser redirects to:**
  `https://myphotosite.com/callback?code=AUTHORIZATION_CODE_XYZ`

**Result:** The User is now back on the Client App, and the Client App has received the Authorization Code.

---

### Phase 2: Exchanging Code for Access Token

_This phase happens "Back-channel" (Server-to-Server) to ensure security._

**5. The Client App Sends the Code**
The Client App receives the `code` from the URL. It now needs to exchange this code for the actual key (Access Token).
The Client App makes a direct **HTTP POST** request to the Authorization Server's token endpoint.

- **POST Request:**
  - **URL:** `https://oauth2.googleapis.com/token`
  - **Body:**
    - `grant_type=authorization_code`
    - `code=AUTHORIZATION_CODE_XYZ` (from previous step)
    - `redirect_uri=https://myphotosite.com/callback`
    - `client_id=XYZ`
    - `client_secret=SECRET_KEY` (This is crucial—it proves the request is coming from the legitimate app, not a hacker who stole the code).

**6. The Provider Validates and Issues Token**
The Authorization Server receives the POST request and performs checks:

1.  Is the `authorization_code` valid and not expired?
2.  Does the `client_id` match the one the code was generated for?
3.  Is the `client_secret` correct?
4.  Does the `redirect_uri` match the one used in Phase 1?

If everything matches, the Provider generates an **Access Token** (and optionally a Refresh Token).

**7. Sending Back the Token**
The Authorization Server responds to the Client App's POST request with a JSON object.

- **JSON Response:**
  ```json
  {
    "access_token": "ACCESS_TOKEN_12345",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "REFRESH_TOKEN_ABCDE"
  }
  ```

**Result:** The Client App now has the Access Token. The user is officially "logged in" from their perspective.

---

### Why is it done this way? (The Security Logic)

You might wonder: _Why not just give the Access Token in Step 4?_

1.  **Protecting the Token:** If the Provider sent the Access Token directly to the browser (via the redirect URL), it would be visible in the browser's history and address bar. Malware or browser extensions could steal it.
2.  **Authenticating the App:** By forcing the Client App to exchange the code using a `client_secret` (Step 5), the Provider ensures that the token is only given to the legitimate application, not someone who just intercepted the code.

### Summary Flow

1.  **User** -> clicks login.
2.  **Client App** -> redirects browser to Provider.
3.  **Provider** -> authenticates User (Login/Password).
4.  **Provider** -> redirects browser back to Client App with **Auth Code**.
5.  **Client App** -> sends Auth Code + Secret to Provider (Server-to-Server).
6.  **Provider** -> validates and sends back **Access Token**.

## If my app is SPA or mobile app, what happen?

This is a critical question. The standard Authorization Code flow I described previously relies on a **Client Secret** to exchange the code for a token.

**The Problem:** In a Single Page Application (SPA) or Mobile App, you cannot keep a "Client Secret" safe.

- **SPAs:** All code (JavaScript) is downloaded to the user's browser. Anyone can "View Source" or open DevTools and steal your secret.
- **Mobile Apps:** Hackers can decompile or reverse-engineer your app binary to find hardcoded strings.

Because the secret cannot be protected, these apps are called **Public Clients**. To solve this, OAuth 2.0 uses a modified flow called **Authorization Code Flow with PKCE** (pronounced "Pixie").

Here is how the flow changes to secure your SPA or Mobile App:

### The Solution: PKCE (Proof Key for Code Exchange)

Instead of using a static `client_secret`, the app generates a temporary, dynamic secret for every single login request.

#### Phase 1: The App Prepares a "Secret"

Before the login process starts, your SPA/Mobile App does something new:

1.  **Generate Verifier:** The app creates a random cryptographically random string (e.g., `random_string_123`). This is called the **Code Verifier**.
2.  **Generate Challenge:** The app hashes this string (transforms it) into a second string. This is called the **Code Challenge**.
3.  **Store Verifier:** The app saves the `Code Verifier` in local memory (or local storage) for later.

#### Phase 2: Authentication (Similar to before, but with Challenge)

1.  **Redirect:** The app redirects the user to the OAuth Provider (e.g., Google).
2.  **New Parameter:** Along with the standard request, the app sends the **Code Challenge** and the hashing method used.
    - _URL:_ `.../authorize?...&code_challenge=HASHED_STRING&code_challenge_method=S256`
3.  **User Logs In:** The user authenticates on the provider's site (same as before).
4.  **Code Return:** The Provider redirects back to your app with the **Authorization Code**.

#### Phase 3: The Exchange (The Magic of PKCE)

Now the app needs to exchange the code for the token.

1.  **Token Request:** The app sends the Authorization Code to the Provider's token endpoint.
2.  **No Client Secret:** The app does **not** send a static client secret.
3.  **The Proof:** Instead, the app sends the original **Code Verifier** (the un-hashed random string it generated in Phase 1).
    - _POST Body:_ `code=AUTH_CODE&code_verifier=random_string_123`

#### Phase 4: Provider Validation

The Provider validates the request differently now:

1.  It takes the **Code Verifier** sent by the app.
2.  It hashes it using the method the app declared in Phase 2.
3.  It compares this result to the **Code Challenge** it received in Phase 2.
4.  **Match?** If they match, the Provider knows the request is coming from the same app that started the login process. It issues the **Access Token**.

---

### Why this is secure

Even if a hacker intercepts the **Authorization Code** (e.g., via a malicious browser extension or logging the URL), they cannot exchange it for a token.

Why? Because when they try to exchange the code, the Provider will ask for the **Code Verifier**. The hacker doesn't know it because it was never sent over the network; it was generated and stored locally inside your app's memory.

### What about "Implicit Flow"? (Deprecated)

In the past, OAuth 2.0 had a flow called **Implicit Flow** where the Access Token was returned directly in the URL (Step 4 of the first explanation).

**This is now widely deprecated and considered insecure.**

- **Reason:** It leaks the token into browser history and makes the app vulnerable to token theft (Cross-Site Scripting attacks).
- **Current Standard:** Everyone (SPAs and Mobile Apps) should use **Authorization Code Flow with PKCE**.

### Summary for SPAs/Mobile

1.  **No Client Secret:** You don't embed secrets in your frontend code.
2.  **Dynamic Secret:** You create a temporary secret (Code Verifier/Challenge) for every login session.
3.  **PKCE:** This mechanism proves your app's identity without exposing a permanent password.

## Use Case: user login to JSP web app, and SPA is rendered by server side JSP dynamically, SPA does not login anymore, how to pass access token (JWT) to SPA?

This is a very common "Hybrid Architecture" scenario. Since the JSP (Server-Side) handles the login, it holds the Access Token securely on the server. However, the SPA (Client-Side) needs that token to make independent API calls (via AJAX/Fetch) without exposing it insecurely.

Here are the three standard ways to handle this, ranked from "Easiest to Implement" to "Most Secure."

### Method 1: Server-Side Injection (The "Bootstrapping" Approach)

This is the most common method for hybrid apps. The JSP server injects the Access Token directly into the generated HTML page as a JavaScript variable.

**1. The JSP Render:**
When the server renders the page, it places the token inside a `<script>` tag or a hidden HTML element.

```jsp
<!-- Inside your JSP file -->
<script>
  // Injecting the token securely from server variable to JS global variable
  window.appConfig = {
    accessToken: '<%= session.getAttribute("access_token") %>',
    user: {
        id: '<%= user.getId() %>',
        name: '<%= user.getName() %>'
    }
  };
</script>
<!-- Load your SPA bundle after the config -->
<script src="/static/js/spa-bundle.js"></script>
```

**2. The SPA Usage:**
When your SPA (React, Vue, Angular) initializes, it reads this global variable to configure its HTTP client (e.g., Axios).

```javascript
// Inside your SPA code (e.g., main.js or store.js)
const accessToken = window.appConfig.accessToken;

// Configure Axios interceptors
axios.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
```

**Pros:** Very simple to implement.
**Cons:** If the page is cached by a proxy or the browser, the token might be cached too. It is also visible if the user opens "View Source," though this is usually considered acceptable since the user owns the token.

---

### Method 2: The "Silent Refresh" Endpoint (More Secure)

In this approach, the JSP does **not** inject the token into the HTML. Instead, the SPA requests the token from the server via a dedicated API endpoint immediately after loading.

**1. Create a Backend Endpoint:**
Create a JSP/Servlet endpoint (e.g., `/api/auth/me`) that reads the token from the server session and returns it as JSON.

```java
// Java Servlet Example
@GetMapping("/api/auth/token")
public void getToken(HttpServletRequest req, HttpServletResponse res) {
    // Read token from secure server-side session
    String token = (String) req.getSession().getAttribute("access_token");

    res.setContentType("application/json");
    res.getWriter().write("{\"accessToken\": \"" + token + "\"}");
}
```

**2. The SPA Fetches on Load:**
The SPA makes a network call to get the token.

```javascript
// SPA Initialization
async function initApp() {
  const response = await fetch("/api/auth/token");
  const data = await response.json();

  // Now store 'data.accessToken' in memory
  // and configure your API client
}
```

**Pros:** Keeps the token out of the HTML source and prevents caching issues.
**Cons:** Adds one extra HTTP request on page load.

---

### Method 3: HttpOnly Cookies (Most Secure)

This is the **best practice** for security, but it requires changes to how your APIs handle authentication.

Instead of passing the token to the JavaScript (SPA) at all, the JSP server sets the Access Token as an **HttpOnly Cookie**.

**1. JSP Sets Cookie:**
When the server gets the token from the OAuth provider, it sets it in the response header as a cookie.

```java
// Creating a secure cookie
Cookie tokenCookie = new Cookie("access_token", accessToken);
tokenCookie.setHttpOnly(true); // JavaScript CANNOT read this
tokenCookie.setSecure(true);   // Only sent over HTTPS
tokenCookie.setPath("/");
response.addCookie(tokenCookie);
```

**2. The SPA Makes Requests:**
The SPA does not need to know the token exists. When the SPA makes an API call (using `fetch` or `axios`), the browser **automatically** attaches the cookie to the request.

```javascript
// SPA Code
fetch("/api/user-profile", {
  credentials: "include", // Ensures cookies are sent
})
  .then((res) => res.json())
  .then((data) => console.log(data));
```

**3. Backend Verification:**
Your backend APIs must be configured to look for the token in the Cookie header instead of the Authorization header.

**Pros:**

- **XSS Protection:** Since the JavaScript cannot read the cookie (HttpOnly), hackers cannot steal the token via Cross-Site Scripting (XSS) attacks.
- **No Token Management in JS:** The SPA code is cleaner.

**Cons:**

- **CSRF Risk:** You must implement CSRF protection (e.g., using `SameSite` cookie attributes or CSRF tokens) because browsers send cookies automatically.
- **CORS:** Requires careful configuration if your SPA and API are on different domains.

### Recommendation

1.  **If you want to start quickly:** Use **Method 1 (Injection)**. Just be sure to escape the string properly in JSP to prevent XSS injection attacks.
2.  **If you want high security:** Use **Method 3 (HttpOnly Cookies)**. This prevents JavaScript from ever touching the sensitive token, effectively mitigating token theft via XSS.

### Important: Handling Token Expiration

JWTs have short lifespans (e.g., 15-60 minutes).

- If using **Injection**: When the token expires, the SPA will get a 401 error. You should redirect the user back to the JSP login page to get a new session.
- If using **Cookies**: The server should check the cookie validity. If the token expires, the server can use a "Refresh Token" (stored securely in the DB) to get a new Access Token and update the cookie automatically. The SPA user won't even notice the token changed.
