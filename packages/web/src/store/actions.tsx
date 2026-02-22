import { Dispatch } from "redux";
import { User } from "@demo/common";

// ─────────────────────────────────────────────────────────────
// 📣 Action Type Constants
// ─────────────────────────────────────────────────────────────
// String constants used to identify each action.
// Exporting as constants (not raw strings) means TypeScript catches
// typos at compile time — "FETCH_USERS_SUCESS" would be a type error,
// but hardcoded in a switch case it would silently fail.
export const FETCH_USERS_SUCCESS = "FETCH_USERS_SUCCESS";
export const SET_LOADING = "SET_LOADING";
export const SET_ERROR = "SET_ERROR";
export const LOGIN_SUCCESS = "LOGIN_SUCCESS";
export const LOGOUT = "LOGOUT";

// ─────────────────────────────────────────────────────────────
// 📐 Data Shape
// ─────────────────────────────────────────────────────────────
// Mirrors the API response shape from GET /api/users:
// { raw: User, formatted: string }
export interface FormattedUser {
  raw: User; // original user object from the backend
  formatted: string; // pre-formatted display string e.g. "User: Alice (ID: 1)"
}

// ─────────────────────────────────────────────────────────────
// 📐 Action Interfaces
// ─────────────────────────────────────────────────────────────
// Each action has a `type` (what happened) and a `payload` (the data).
// Using `typeof FETCH_USERS_SUCCESS` instead of `string` gives us
// discriminated union support — TypeScript can narrow the type inside
// switch/case blocks based on the `type` field alone.

interface FetchUsersSuccessAction {
  type: typeof FETCH_USERS_SUCCESS;
  payload: FormattedUser[]; // the fetched users to store in state
}

interface SetLoadingAction {
  type: typeof SET_LOADING;
  payload: boolean; // true = request in flight, false = done
}

// carries an error message string (or null to clear the error)
interface SetErrorAction {
  type: typeof SET_ERROR;
  payload: string | null;
}

interface LoginSuccessAction {
  type: typeof LOGIN_SUCCESS;
  payload: { token: string; username: string };
}

interface LogoutAction {
  type: typeof LOGOUT;
}

// ✅ Union type: UserAction is any one of the above.
// The reducer accepts this union and narrows it via switch(action.type).
export type UserAction =
  | FetchUsersSuccessAction
  | SetLoadingAction
  | SetErrorAction
  | LoginSuccessAction
  | LogoutAction;

// ─────────────────────────────────────────────────────────────
// 🌐 API Base URL
// ─────────────────────────────────────────────────────────────
// ✅ Defined at module level so ALL thunks can access it.
// Replaced at build time by webpack DefinePlugin — never reaches the browser
// as a raw process.env reference.
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";

// ─────────────────────────────────────────────────────────────
// 🔑 Thunk: login
// ─────────────────────────────────────────────────────────────
// Sends credentials to POST /auth/login.
// On success, dispatches LOGIN_SUCCESS with the JWT token.
// The token is stored in Redux state and sent with every subsequent request.
//
// Flow:
//   1. dispatch(login(username, password))  ← LoginPage triggers this
//   2. SET_LOADING true                     ← button shows "Signing in..."
//   3. SET_ERROR null                       ← clear previous errors
//   4. POST /auth/login                     ← API call
//   5a. LOGIN_SUCCESS + token               ← success: App renders
//   5b. SET_ERROR "message"                 ← failure: error shown on form
//   6. SET_LOADING false                    ← button re-enabled
export const login = (username: string, password: string) => {
  return async (dispatch: Dispatch<UserAction>) => {
    // ✅ typed consistently
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

      // ✅ Store token in Redux state (in-memory only)
      // Lost on page refresh — for persistence use sessionStorage
      // and rehydrate on app startup. Never use localStorage for tokens.
      dispatch({ type: LOGIN_SUCCESS, payload: { token, username: name } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      dispatch({ type: SET_ERROR, payload: message });
    } finally {
      dispatch({ type: SET_LOADING, payload: false });
    }
  };
};

// ─────────────────────────────────────────────────────────────
// ⚡ Thunk: fetchUsers
// ─────────────────────────────────────────────────────────────
// Fetches all users from GET /api/users, authenticated with JWT.
// Token comes from Redux state (state.users.token) via App.tsx.
//
// Flow:
//   1. dispatch(fetchUsers(token))        ← App.tsx triggers on mount
//   2. SET_LOADING true                   ← spinner starts
//   3. SET_ERROR null                     ← clear any previous error
//   4. GET /api/users + Bearer token      ← authenticated API call
//   5a. FETCH_USERS_SUCCESS + data        ← success: users render
//   5b. SET_ERROR "message"               ← failure: error shown in UI
//   6. SET_LOADING false                  ← spinner stops (always via finally)
export const fetchUsers = (token: string) => {
  return async (dispatch: Dispatch<UserAction>) => {
    dispatch({ type: SET_LOADING, payload: true });
    dispatch({ type: SET_ERROR, payload: null });

    try {
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // ✅ JWT sent with every request
        },
      });

      // ✅ fetch() only rejects on network failure, NOT on 4xx/5xx.
      // Must manually check response.ok to catch API-level errors.
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: FormattedUser[] = await response.json();
      dispatch({ type: FETCH_USERS_SUCCESS, payload: data });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      dispatch({ type: SET_ERROR, payload: message });
    } finally {
      // ✅ finally guarantees loading clears whether call succeeded or failed
      dispatch({ type: SET_LOADING, payload: false });
    }
  };
};
