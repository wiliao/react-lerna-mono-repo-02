import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUsers } from "./store/actions";
import { APP_NAME } from "@demo/common";

function App() {
  const dispatch = useDispatch();
  const { users, loading } = useSelector((state) => state);

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
          {users.map((user, idx) => (
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
