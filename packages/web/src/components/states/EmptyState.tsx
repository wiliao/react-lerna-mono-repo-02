// src/components/states/EmptyState.tsx
import { emptyState } from "../../styles/mainStyles";

export function EmptyState() {
  return (
    <div style={emptyState.container}>
      <div style={emptyState.icon}>🕳️</div>
      <p>No users found.</p>
    </div>
  );
}
