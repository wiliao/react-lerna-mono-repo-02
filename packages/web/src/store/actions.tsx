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
export const SET_ERROR = "SET_ERROR"; // ✅ NEW: surface API errors to the UI

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

// ✅ NEW: carries an error message string (or null to clear the error)
interface SetErrorAction {
  type: typeof SET_ERROR;
  payload: string | null;
}

// ✅ Union type: UserAction is any one of the above.
// The reducer accepts this union and narrows it via switch(action.type).
export type UserAction =
  | FetchUsersSuccessAction
  | SetLoadingAction
  | SetErrorAction;

// ─────────────────────────────────────────────────────────────
// ⚡ Thunk Action Creator: fetchUsers
// ─────────────────────────────────────────────────────────────
// A regular action creator returns a plain object: { type, payload }
// A THUNK action creator returns a FUNCTION instead.
// Redux Thunk middleware intercepts that function and calls it with
// `dispatch`, allowing us to run async logic (API calls) before
// dispatching the real action.
//
// Flow:
//   1. dispatch(fetchUsers())         ← component triggers the thunk
//   2. SET_LOADING true               ← spinner starts
//   3. SET_ERROR null                 ← clear any previous error
//   4. await fetch(...)               ← API call
//   5a. FETCH_USERS_SUCCESS + data    ← success: state updated with users
//   5b. SET_ERROR "message"           ← failure: error surfaced to the UI
//   6. SET_LOADING false              ← spinner stops (always, via finally)
export const fetchUsers = () => {
  return async (dispatch: Dispatch<UserAction>) => {
    // ✅ Tell the UI a request is in flight and clear any previous error
    dispatch({ type: SET_LOADING, payload: true });
    dispatch({ type: SET_ERROR, payload: null });

    try {
      const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";
      const response = await fetch(`${API_URL}/api/users`);

      // ✅ fetch() only rejects on network failure, NOT on 4xx/5xx responses.
      // We must manually check response.ok to catch API-level errors.
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: FormattedUser[] = await response.json();

      // ✅ Success: hand the data to the reducer to update state
      dispatch({ type: FETCH_USERS_SUCCESS, payload: data });
    } catch (error) {
      // ✅ Dispatch the error message to state so the UI can render it
      // instead of silently showing an empty list
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      dispatch({ type: SET_ERROR, payload: message });
    } finally {
      // ✅ finally guarantees loading is cleared whether the call
      // succeeded or failed — prevents a stuck spinner
      dispatch({ type: SET_LOADING, payload: false });
    }
  };
};
