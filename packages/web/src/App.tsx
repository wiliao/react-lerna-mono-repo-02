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
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f6fa",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* ─────────────────────────────────────────────────────────
          🧭 Top Navigation Bar
          ─────────────────────────────────────────────────────────
          Fixed header with app branding + user menu.
          Uses flexbox for horizontal layout and spacing.
          Logout button styled for visibility and hover feedback.
        ───────────────────────────────────────────────────────── */}
      <header
        style={{
          backgroundColor: "#2c3e50",
          color: "white",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        {/* Left: App Branding */}
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
            {APP_NAME}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "12px", opacity: 0.8 }}>
            Frontend: React 19 + Redux 5
          </p>
        </div>

        {/* Right: User Menu */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Username Display */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: "6px",
            }}
          >
            <span style={{ fontSize: "18px" }}>👤</span>
            <span style={{ fontWeight: "500", fontSize: "14px" }}>
              {username}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            style={{
              padding: "10px 20px",
              backgroundColor: "#e74c3c",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "500",
              fontSize: "14px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#c0392b")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#e74c3c")
            }
          >
            Logout
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────
          📦 Main Content Area
          ─────────────────────────────────────────────────────────
          Priority order: loading → error → empty → data
          Never show stale data while loading, always surface
          errors rather than showing a blank unexplained page
        ───────────────────────────────────────────────────────── */}
      <main style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
        {loading ? (
          // 🔄 Loading state: API call is in flight
          <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏳</div>
            <p>Loading users from backend...</p>
          </div>
        ) : error ? (
          // ❌ Error state: network failure, API error, expired token etc.
          <div
            style={{
              backgroundColor: "#fee",
              border: "1px solid #fcc",
              borderRadius: "8px",
              padding: "20px",
              color: "#c00",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚠️</div>
            <p style={{ margin: 0, fontWeight: "500" }}>{error}</p>
          </div>
        ) : users.length === 0 ? (
          // 🕳️ Empty state: request succeeded but no users returned
          <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🕳️</div>
            <p>No users found.</p>
          </div>
        ) : (
          // ✅ Success state: render the list of users
          <div>
            <h2 style={{ marginBottom: "24px", color: "#2c3e50" }}>
              Users ({users.length})
            </h2>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: "16px",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              }}
            >
              {users.map((user: FormattedUser) => (
                // Stable unique key — never use array index
                <li
                  key={user.raw.id}
                  style={{
                    backgroundColor: "white",
                    padding: "20px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                    border: "1px solid #e1e4e8",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        backgroundColor: "#3498db",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "20px",
                      }}
                    >
                      {user.raw.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <strong style={{ fontSize: "16px", color: "#2c3e50" }}>
                        {user.formatted}
                      </strong>
                      <p
                        style={{
                          margin: "4px 0 0",
                          color: "#7f8c8d",
                          fontSize: "12px",
                        }}
                      >
                        ID: {user.raw.id}
                      </p>
                    </div>
                  </div>
                  <details style={{ marginTop: "12px" }}>
                    <summary
                      style={{
                        cursor: "pointer",
                        color: "#3498db",
                        fontSize: "12px",
                      }}
                    >
                      View Raw Data
                    </summary>
                    <pre
                      style={{
                        marginTop: "8px",
                        padding: "12px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "4px",
                        fontSize: "11px",
                        overflow: "auto",
                        color: "#666",
                      }}
                    >
                      {JSON.stringify(user.raw, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
