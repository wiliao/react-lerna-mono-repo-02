// Shared constant
export const APP_NAME = "Lerna Mono Demo (React 19)";

// Shared types
export interface User {
  id: number; // ✅ matches Mongoose schema exactly
  name: string;
}

// Shared function
export const formatUser = (user: User): string => {
  return `User: ${user.name} (ID: ${user.id})`;
};
