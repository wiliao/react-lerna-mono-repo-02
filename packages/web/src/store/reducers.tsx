import { UnknownAction } from "@reduxjs/toolkit";
import {
  FETCH_USERS_SUCCESS,
  SET_LOADING,
  SET_ERROR, // ✅ NEW
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
  error: string | null; // ✅ NEW: error message, or null if no error
}

// ✅ Initial state: what the store looks like before any actions are dispatched.
// Redux calls the reducer with this value on first render.
const initialState: UserState = {
  users: [],
  loading: false,
  error: null, // ✅ NEW
};

// ─────────────────────────────────────────────────────────────
// 🛡️ Type Guard: isUserAction
// ─────────────────────────────────────────────────────────────
// Redux internally dispatches its own actions (e.g. @@INIT) which are typed
// as UnknownAction. This type guard narrows the union so TypeScript knows
// we're handling only OUR actions inside the switch statement.
// Without this, TypeScript would complain about accessing action.payload.
function isUserAction(
  action: UserAction | UnknownAction,
): action is UserAction {
  return (
    action.type === FETCH_USERS_SUCCESS ||
    action.type === SET_LOADING ||
    action.type === SET_ERROR // ✅ NEW
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
      // ✅ Spread operator creates a NEW object — never mutate state directly.
      // Only `users` changes; `loading` and `error` are preserved from current state.
      return { ...state, users: action.payload };

    case SET_LOADING:
      // ✅ Only `loading` changes; `users` and `error` are preserved.
      return { ...state, loading: action.payload };

    case SET_ERROR:
      // ✅ NEW: Only `error` changes; `users` and `loading` are preserved.
      return { ...state, error: action.payload };

    default:
      // ✅ Always return current state for unrecognised actions.
      // Returning undefined would break Redux.
      return state;
  }
};

export default userReducer;
