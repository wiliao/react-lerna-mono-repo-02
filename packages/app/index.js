const express = require("express");
const cors = require("cors");
const { APP_NAME, formatUser } = require("@demo/common");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

app.get("/", (req, res) => {
  res.send(`Backend Service: ${APP_NAME}`);
});

app.get("/api/users", (req, res) => {
  const formattedUsers = users.map((u) => ({
    raw: u,
    formatted: formatUser(u),
  }));
  res.json(formattedUsers);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
