import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUsers } from "./store/actions";
import { APP_NAME, User } from "@demo/common";
import { AppDispatch, RootState } from "./store";

interface FormattedUser {
  raw: User;
  formatted: string;
}

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { users, loading } = useSelector((state: RootState) => state.users);

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>{APP_NAME}</h1>
      <h2>Frontend: React 19 + Redux 5</h2>

      {loading ? (
        <p>Loading users from backend...</p>
      ) : (
        <ul>
          {users.map((user: FormattedUser, idx: number) => (
            <li key={idx} style={{ marginBottom: "10px" }}>
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
