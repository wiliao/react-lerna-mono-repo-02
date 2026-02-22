import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUsers, LOGOUT, FormattedUser } from "./store/actions";
import { APP_NAME } from "@demo/common";
import { AppDispatch, RootState } from "./store";
import LoginPage from "./LoginPage";

function App() {
  // ─────────────────────────────────────────────────────────────
  // 🏪 Redux Hooks
  // ─────────────────────────────────────────────────────────────

  // useDispatch: returns the store's dispatch function
  // Typed as AppDispatch so TypeScript knows it can handle thunks
  const dispatch = useDispatch<AppDispatch>();

  // useSelector: reads the users slice from Redux store
  // Includes token and username for auth state
  const { users, loading, error, token, username } = useSelector(
    (state: RootState) => state.users,
  );

  // ─────────────────────────────────────────────────────────────
  // ⚡ Side Effect: Fetch Users
  // ─────────────────────────────────────────────────────────────
  // ✅ MUST be before any early return — React requires hooks to always
  // be called in the same order on every render, never conditionally.
  // Placing useEffect after an early return violates the rules of hooks
  // and causes React to skip the hook call when token is null,
  // breaking the hook call order and causing subtle bugs.
  //
  // Guard lives INSIDE the effect instead of outside:
  // - token null  → effect runs but returns early, nothing dispatched
  // - token valid → fetchUsers fires with the JWT
  useEffect(() => {
    if (!token) return; // ✅ guard inside effect, not before it
    dispatch(fetchUsers(token));
  }, [dispatch, token]);

  // ─────────────────────────────────────────────────────────────
  // 🔐 Auth Gate — placed AFTER all hooks
  // ─────────────────────────────────────────────────────────────
  // token is null on first load and after logout.
  // Once LOGIN_SUCCESS is dispatched, token is set and main App renders.
  if (!token) {
    return <LoginPage />;
  }

  // ─────────────────────────────────────────────────────────────
  // 🚪 Logout Handler
  // ─────────────────────────────────────────────────────────────
  // Dispatches LOGOUT which resets state to initialState.
  // token becomes null → auth gate above → LoginPage renders.
  const handleLogout = () => {
    dispatch({ type: LOGOUT });
  };

  // ─────────────────────────────────────────────────────────────
  // 🎨 Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      {/* ── Header with logout ───────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1>{APP_NAME}</h1>
          <h2>Frontend: React 19 + Redux 5</h2>
        </div>
        <div style={{ textAlign: "right" }}>
          {/* Show logged-in username from Redux state */}
          <p style={{ margin: 0, color: "#666" }}>👤 {username}</p>
          <button
            onClick={handleLogout}
            style={{
              marginTop: "8px",
              padding: "6px 16px",
              backgroundColor: "#cc0000",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {/* Priority order: loading → error → empty → data
          Never show stale data while loading, always surface
          errors rather than showing a blank unexplained page  */}
      {loading ? (
        // 🔄 Loading state: API call is in flight
        <p>Loading users from backend...</p>
      ) : error ? (
        // ❌ Error state: network failure, API error, expired token etc.
        <p style={{ color: "red" }}>⚠️ {error}</p>
      ) : users.length === 0 ? (
        // 🕳️ Empty state: request succeeded but no users returned
        <p style={{ color: "#999" }}>No users found.</p>
      ) : (
        // ✅ Success state: render the list of users
        <ul>
          {users.map((user: FormattedUser) => (
            // Stable unique key — never use array index
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
