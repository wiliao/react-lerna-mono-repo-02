// src/components/UserCard.tsx
import { memo, useMemo } from "react";
import { FormattedUser } from "../store/actions";
import { userCard } from "../styles/mainStyles";

interface UserCardProps {
  user: FormattedUser;
}

// ✅ React.memo prevents re-render if user object hasn't changed
export const UserCard = memo(function UserCard({ user }: UserCardProps) {
  // ✅ Memoize expensive JSON.stringify operation
  const rawData = useMemo(() => JSON.stringify(user.raw, null, 2), [user.raw]);

  const initial = user.raw.name?.charAt(0).toUpperCase() || "U";

  return (
    <li key={user.raw.id} style={userCard.container}>
      {/* Card Header: Avatar + Name + ID */}
      <div style={userCard.header}>
        <div style={userCard.avatar}>{initial}</div>
        <div>
          <strong style={userCard.userInfo.name}>{user.formatted}</strong>
          <p style={userCard.userInfo.id}>ID: {user.raw.id}</p>
        </div>
      </div>

      {/* Collapsible Raw Data */}
      <details style={userCard.details}>
        <summary style={userCard.summary}>View Raw Data</summary>
        <pre style={userCard.pre}>{rawData}</pre>
      </details>
    </li>
  );
});
