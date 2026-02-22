// src/components/states/LoadingState.tsx
import { loadingState } from "../../styles/mainStyles";

export function LoadingState() {
  return (
    <div style={loadingState.container}>
      <div style={loadingState.icon}>⏳</div>
      <p>Loading users from backend...</p>
    </div>
  );
}
