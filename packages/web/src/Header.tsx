// src/Header.tsx
import { useSelector } from "react-redux";
import { RootState } from "./store";

interface HeaderProps {
  onLogout: () => void;
}

function Header({ onLogout }: HeaderProps) {
  const { username } = useSelector((state: RootState) => state.users);

  return (
    <header
      style={{
        backgroundColor: "#2c3e50",
        color: "white",
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      {/* Left: App Title */}
      <div>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>
          Lerna Mono Demo (React 19)
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "14px", opacity: 0.8 }}>
          Frontend: React 19 + Redux 5
        </p>
      </div>

      {/* Right: User Menu */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {/* User Info */}
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
          <span style={{ fontSize: "20px" }}>👤</span>
          <span style={{ fontWeight: "500" }}>{username}</span>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
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
  );
}

export default Header;
