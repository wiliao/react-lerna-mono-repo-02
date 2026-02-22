import { UnknownAction } from "@reduxjs/toolkit";
import {
  FETCH_USERS_SUCCESS,
  SET_LOADING,
  SET_ERROR,
  LOGIN_SUCCESS,
  LOGOUT,
  UserAction,
  FormattedUser,
} from "./actions";

// ─────────────────────────────────────────────────────────────
// 📐 State Shape
// ─────────────────────────────────────────────────────────────
// This interface defines what the "users" slice of Redux state looks like.
// Every component that reads from state.users will see this shape.
export interface UserState {
  users: FormattedUser[]; // the list of users fetched from the API
  loading: boolean; // true while the API request is in flight
  error: string | null; // error message, or null if no error
  token: string | null; // JWT — sent with every authenticated request
  username: string | null; // logged-in username for display in UI
}

// ✅ Initial state: what the store looks like before any actions are dispatched.
// Redux calls the reducer with this value on first render.
// token: null means no one is logged in → LoginPage renders.
const initialState: UserState = {
  users: [],
  loading: false,
  error: null,
  token: null,
  username: null,
};

// ─────────────────────────────────────────────────────────────
// 🛡️ Type Guard: isUserAction
// ─────────────────────────────────────────────────────────────
// Redux internally dispatches its own actions (e.g. @@INIT) typed
// as UnknownAction. This type guard narrows the union so TypeScript
// knows we're handling only OUR actions inside the switch statement.
// Without this, TypeScript would complain about accessing action.payload.
function isUserAction(
  action: UserAction | UnknownAction,
): action is UserAction {
  return (
    action.type === FETCH_USERS_SUCCESS ||
    action.type === SET_LOADING ||
    action.type === SET_ERROR ||
    action.type === LOGIN_SUCCESS ||
    action.type === LOGOUT
  );
}

// ─────────────────────────────────────────────────────────────
// 🔄 Reducer: userReducer
// ─────────────────────────────────────────────────────────────
// A reducer is a PURE function: (currentState, action) => newState
// Rules:
//   1. Never mutate state directly — always return a new object
//   2. Given the same inputs, always return the same output
//   3. No side effects (no API calls, no random values, no Date.now())
const userReducer = (
  state: UserState = initialState,
  action: UserAction | UnknownAction,
): UserState => {
  // ✅ Ignore Redux's internal actions (@@INIT etc.) — return state unchanged
  if (!isUserAction(action)) return state;

  switch (action.type) {
    case FETCH_USERS_SUCCESS:
      // Spread creates a NEW object — never mutate state directly.
      // Only `users` changes; all other fields preserved from current state.
      return { ...state, users: action.payload };

    case SET_LOADING:
      // Only `loading` changes; all other fields preserved.
      return { ...state, loading: action.payload };

    case SET_ERROR:
      // Only `error` changes; all other fields preserved.
      return { ...state, error: action.payload };

    case LOGIN_SUCCESS:
      // Store token and username on successful login.
      // Clears error so any previous login failure message is removed.
      return {
        ...state,
        token: action.payload.token,
        username: action.payload.username,
        error: null,
      };

    case LOGOUT:
      // Reset entire slice to initialState — clears token, users, everything.
      // token becomes null → auth gate in App.tsx → LoginPage renders.
      return { ...initialState };

    default:
      // Always return current state for unrecognised actions.
      // Returning undefined would break Redux.
      return state;
  }
};

export default userReducer;
