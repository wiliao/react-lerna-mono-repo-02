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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          padding: "40px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          width: "320px",
        }}
      >
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
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "12px",
            boxSizing: "border-box",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "20px",
            boxSizing: "border-box",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={loading || !username.trim() || !password.trim()}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#0066cc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "16px",
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
