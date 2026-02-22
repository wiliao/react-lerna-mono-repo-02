// src/components/UserList.tsx
import { FormattedUser } from "../store/actions";
import { UserCard } from "./UserCard";
import { userList } from "../styles/mainStyles";

interface UserListProps {
  users: FormattedUser[];
}

export function UserList({ users }: UserListProps) {
  return (
    <div>
      <h2 style={userList.heading}>Users ({users.length})</h2>
      <ul style={userList.container}>
        {users.map((user) => (
          // ✅ Stable unique key — never use array index
          <UserCard key={user.raw.id} user={user} />
        ))}
      </ul>
    </div>
  );
}
