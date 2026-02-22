# How to introduce authentication

Yes, you need a login page. Here's the full integration with your existing Redux setup:

---

## 1. Add auth state to Redux

**`store/actions.tsx`** — add auth action types alongside existing ones:

```typescript
export const LOGIN_SUCCESS = "LOGIN_SUCCESS";
export const LOGOUT = "LOGOUT";

interface LoginSuccessAction {
  type: typeof LOGIN_SUCCESS;
  payload: { token: string; username: string };
}

interface LogoutAction {
  type: typeof LOGOUT;
}

export type UserAction =
  | FetchUsersSuccessAction
  | SetLoadingAction
  | SetErrorAction
  | LoginSuccessAction // ✅ NEW
  | LogoutAction; // ✅ NEW

// ─── Login thunk ─────────────────────────────────────────────
export const login = (username: string, password: string) => {
  return async (dispatch: Dispatch<UserAction>) => {
    dispatch({ type: SET_LOADING, payload: true });
    dispatch({ type: SET_ERROR, payload: null });
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error("Invalid username or password");
      const { token, username: name } = await response.json();
      dispatch({ type: LOGIN_SUCCESS, payload: { token, username: name } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      dispatch({ type: SET_ERROR, payload: message });
    } finally {
      dispatch({ type: SET_LOADING, payload: false });
    }
  };
};

// ─── Update fetchUsers to accept token ───────────────────────
export const fetchUsers = (token: string) => {
  return async (dispatch: Dispatch<UserAction>) => {
    dispatch({ type: SET_LOADING, payload: true });
    dispatch({ type: SET_ERROR, payload: null });
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // ✅ send JWT
        },
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data: FormattedUser[] = await response.json();
      dispatch({ type: FETCH_USERS_SUCCESS, payload: data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      dispatch({ type: SET_ERROR, payload: message });
    } finally {
      dispatch({ type: SET_LOADING, payload: false });
    }
  };
};
```

---

**`store/reducers.tsx`** — add auth fields to state:

```typescript
import {
  FETCH_USERS_SUCCESS,
  SET_LOADING,
  SET_ERROR,
  LOGIN_SUCCESS,
  LOGOUT, // ✅ NEW
  UserAction,
  FormattedUser,
} from "./actions";

export interface UserState {
  users: FormattedUser[];
  loading: boolean;
  error: string | null;
  token: string | null; // ✅ NEW — JWT for API calls
  username: string | null; // ✅ NEW — display in UI
}

const initialState: UserState = {
  users: [],
  loading: false,
  error: null,
  token: null,
  username: null,
};

function isUserAction(
  action: UserAction | UnknownAction,
): action is UserAction {
  return [
    FETCH_USERS_SUCCESS,
    SET_LOADING,
    SET_ERROR,
    LOGIN_SUCCESS,
    LOGOUT, // ✅ NEW
  ].includes(action.type as string);
}

const userReducer = (
  state: UserState = initialState,
  action: UserAction | UnknownAction,
): UserState => {
  if (!isUserAction(action)) return state;

  switch (action.type) {
    case FETCH_USERS_SUCCESS:
      return { ...state, users: action.payload };
    case SET_LOADING:
      return { ...state, loading: action.payload };
    case SET_ERROR:
      return { ...state, error: action.payload };

    case LOGIN_SUCCESS:
      // ✅ Store token and username — clears any previous error
      return {
        ...state,
        token: action.payload.token,
        username: action.payload.username,
        error: null,
      };

    case LOGOUT:
      // ✅ Wipe everything on logout
      return { ...initialState };

    default:
      return state;
  }
};

export default userReducer;
```

---

## 2. Create `LoginPage.tsx`

```typescriptreact
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { login } from "./store/actions";
import { AppDispatch, RootState } from "./store";

function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.users);

  // ✅ Local state for form fields — no need for Redux here,
  // form input is UI-only state that nothing else needs to read
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = () => {
    if (!username.trim() || !password.trim()) return;
    dispatch(login(username, password));
  };

  // ✅ Allow Enter key to submit — better UX than click-only
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100vh", fontFamily: "Arial, sans-serif",
    }}>
      <div style={{
        padding: "40px", border: "1px solid #ddd",
        borderRadius: "8px", width: "320px",
      }}>
        <h2 style={{ marginBottom: "24px", textAlign: "center" }}>
          🔐 Sign In
        </h2>

        {/* ✅ Show error from Redux state — covers wrong password, network errors etc. */}
        {error && (
          <p style={{ color: "red", marginBottom: "16px", fontSize: "14px" }}>
            ⚠️ {error}
          </p>
        )}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          style={{ width: "100%", padding: "10px", marginBottom: "12px",
            boxSizing: "border-box", border: "1px solid #ccc", borderRadius: "4px" }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          style={{ width: "100%", padding: "10px", marginBottom: "20px",
            boxSizing: "border-box", border: "1px solid #ccc", borderRadius: "4px" }}
        />

        <button
          onClick={handleSubmit}
          disabled={loading || !username.trim() || !password.trim()}
          style={{
            width: "100%", padding: "10px", backgroundColor: "#0066cc",
            color: "white", border: "none", borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer", fontSize: "16px",
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
```

---

## 3. Update `App.tsx` — gate on auth state

```typescriptreact
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUsers, LOGOUT, FormattedUser } from "./store/actions";
import { APP_NAME } from "@demo/common";
import { AppDispatch, RootState } from "./store";
import LoginPage from "./LoginPage";

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { users, loading, error, token, username } = useSelector(
    (state: RootState) => state.users,
  );

  // ─────────────────────────────────────────────────────────────
  // 🔐 Auth gate — show login page if no token
  // ─────────────────────────────────────────────────────────────
  // token is null on first load and after logout
  // Once LOGIN_SUCCESS is dispatched, token is set and App renders
  if (!token) {
    return <LoginPage />;
  }

  // ─────────────────────────────────────────────────────────────
  // ⚡ Fetch users once authenticated
  // ─────────────────────────────────────────────────────────────
  // token in dependency array — re-fetches if token changes
  useEffect(() => {
    dispatch(fetchUsers(token));
  }, [dispatch, token]);

  const handleLogout = () => {
    dispatch({ type: LOGOUT }); // ✅ clears token → LoginPage renders
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>{APP_NAME}</h1>
          <h2>Frontend: React 19 + Redux 5</h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, color: "#666" }}>👤 {username}</p>
          <button
            onClick={handleLogout}
            style={{
              marginTop: "8px", padding: "6px 16px",
              backgroundColor: "#cc0000", color: "white",
              border: "none", borderRadius: "4px", cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {loading ? (
        <p>Loading users from backend...</p>
      ) : error ? (
        <p style={{ color: "red" }}>⚠️ {error}</p>
      ) : users.length === 0 ? (
        <p style={{ color: "#999" }}>No users found.</p>
      ) : (
        <ul>
          {users.map((user: FormattedUser) => (
            <li key={user.raw.id} style={{ marginBottom: "10px" }}>
              <strong>{user.formatted}</strong>
              <br />
              <small style={{ color: "#666" }}>
                Raw Data: {JSON.stringify(user.raw)}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
```

---

## 4. Seed an auth user for testing

Add to `seed.ts`:

```typescript
import bcrypt from "bcrypt";
import { AuthUserModel } from "./db";

// ✅ Seed a test login user
await AuthUserModel.deleteMany({});
const passwordHash = await bcrypt.hash("password123", 12);
await AuthUserModel.create({ username: "admin", passwordHash });
logger.info("🌱 Seeded auth user: admin / password123");
```

---

## Full flow in the browser

```bash
1. Page loads → token is null → LoginPage renders
2. User types "admin" / "password123" → clicks Sign In
3. dispatch(login()) → POST /auth/login → returns JWT
4. LOGIN_SUCCESS → token stored in Redux state
5. App.tsx detects token → renders main app
6. useEffect → dispatch(fetchUsers(token)) → GET /api/users with Bearer token
7. Users render on screen
8. User clicks Logout → dispatch(LOGOUT) → token = null → LoginPage renders again
```

---

One important caveat — storing the token in Redux state means it's lost on page refresh. That's fine for learning, but for production you'd persist it to `sessionStorage` (not `localStorage`) and rehydrate on startup. That's the next step after this is working.
