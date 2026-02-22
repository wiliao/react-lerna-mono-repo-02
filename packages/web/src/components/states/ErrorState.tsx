// src/components/states/ErrorState.tsx
import { errorState } from "../../styles/mainStyles";

interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div style={errorState.container}>
      <div style={errorState.icon}>⚠️</div>
      <p style={errorState.message}>{message}</p>
    </div>
  );
}
