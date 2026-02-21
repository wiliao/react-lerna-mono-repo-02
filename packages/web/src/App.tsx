import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUsers, FormattedUser } from "./store/actions";
// ✅ Import FormattedUser from actions instead of redefining it here —
// a single source of truth prevents the two definitions drifting apart
import { APP_NAME } from "@demo/common";
import { AppDispatch, RootState } from "./store";

function App() {
  // ─────────────────────────────────────────────────────────────
  // 🏪 Redux Hooks
  // ─────────────────────────────────────────────────────────────

  // useDispatch: returns the store's dispatch function
  // Typed as AppDispatch so TypeScript knows it can handle thunks
  const dispatch = useDispatch<AppDispatch>();

  // useSelector: reads a slice of state from the Redux store
  // Re-renders this component whenever users, loading, or error changes
  // ✅ Now also reads `error` — so fetch failures surface in the UI
  const { users, loading, error } = useSelector(
    (state: RootState) => state.users,
  );

  // ─────────────────────────────────────────────────────────────
  // ⚡ Side Effect: Fetch Users on Mount
  // ─────────────────────────────────────────────────────────────
  // useEffect with [] runs once after the first render (componentDidMount equivalent).
  // dispatch is included in the dependency array as required by the rules of hooks,
  // but it's a stable reference from Redux so it never actually triggers a re-fetch.
  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  // ─────────────────────────────────────────────────────────────
  // 🎨 Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>{APP_NAME}</h1>
      <h2>Frontend: React 19 + Redux 5</h2>

      {/* ✅ Priority order: loading → error → data
          This ensures we never show stale data while loading,
          and always surface errors rather than showing an empty list */}
      {loading ? (
        // 🔄 Loading state: API call is in flight
        <p>Loading users from backend...</p>
      ) : error ? (
        // ❌ Error state: something went wrong (network failure, API error, etc.)
        // Shown instead of an empty list so the user knows why there's no data
        <p style={{ color: "red" }}>⚠️ {error}</p>
      ) : users.length === 0 ? (
        // 🕳️ Empty state: request succeeded but no users were returned
        // Without this, the user just sees a blank page with no explanation
        <p style={{ color: "#999" }}>No users found.</p>
      ) : (
        // ✅ Success state: render the list of users
        <ul>
          {users.map((user: FormattedUser) => (
            // ✅ Use user.raw.id as key instead of array index —
            // index-based keys cause React reconciliation bugs when
            // the list is reordered, filtered, or items are removed
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
