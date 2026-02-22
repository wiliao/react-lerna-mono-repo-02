# 🚀 Optimizing Your Main Content Block

Here's a **clean, maintainable, and performant** refactoring that extracts components, memoizes expensive operations, and reduces inline style repetition — while keeping all your comments and TypeScript types.

---

## ✅ Optimizations Applied

| Optimization                       | Benefit                                     |
| ---------------------------------- | ------------------------------------------- |
| 🔹 Extract state components        | Cleaner `App.tsx`, reusable logic           |
| 🔹 Extract `UserCard` component    | Isolate user rendering, enable `React.memo` |
| 🔹 Move styles to constants        | Reduce JSX clutter, enable reuse            |
| 🔹 Memoize `JSON.stringify`        | Avoid recalculating on every render         |
| 🔹 Use `React.memo` for `UserCard` | Prevent unnecessary re-renders              |
| 🔹 Semantic HTML preserved         | Accessibility + SEO friendly                |

---

## 📦 Step 1: Create Style Constants File

```ts
// src/styles/mainStyles.ts

// ─────────────────────────────────────────────────────────────
// 🎨 Main Content Styles
// ─────────────────────────────────────────────────────────────
export const mainContainer = {
  padding: "24px",
  maxWidth: "1200px" as const,
  margin: "0 auto" as const,
};

// ─────────────────────────────────────────────────────────────
// 🔄 Loading State Styles
// ─────────────────────────────────────────────────────────────
export const loadingState = {
  container: {
    textAlign: "center" as const,
    padding: "40px",
    color: "#666",
  },
  icon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
};

// ─────────────────────────────────────────────────────────────
// ❌ Error State Styles
// ─────────────────────────────────────────────────────────────
export const errorState = {
  container: {
    backgroundColor: "#fee",
    border: "1px solid #fcc",
    borderRadius: "8px",
    padding: "20px",
    color: "#c00",
  },
  icon: {
    fontSize: "32px",
    marginBottom: "8px",
  },
  message: {
    margin: 0,
    fontWeight: 500 as const,
  },
};

// ─────────────────────────────────────────────────────────────
// 🕳️ Empty State Styles
// ─────────────────────────────────────────────────────────────
export const emptyState = {
  container: {
    textAlign: "center" as const,
    padding: "40px",
    color: "#999",
  },
  icon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
};

// ─────────────────────────────────────────────────────────────
// 📋 User List Styles
// ─────────────────────────────────────────────────────────────
export const userList = {
  container: {
    listStyle: "none" as const,
    padding: 0,
    margin: 0,
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  },
  heading: {
    marginBottom: "24px",
    color: "#2c3e50",
  },
};

// ─────────────────────────────────────────────────────────────
// 👤 User Card Styles
// ─────────────────────────────────────────────────────────────
export const userCard = {
  container: {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    border: "1px solid #e1e4e8",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#3498db",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: "bold",
    fontSize: "20px",
  },
  userInfo: {
    name: {
      fontSize: "16px",
      color: "#2c3e50",
    },
    id: {
      margin: "4px 0 0",
      color: "#7f8c8d",
      fontSize: "12px",
    },
  },
  details: {
    marginTop: "12px",
  },
  summary: {
    cursor: "pointer",
    color: "#3498db",
    fontSize: "12px",
  },
  pre: {
    marginTop: "8px",
    padding: "12px",
    backgroundColor: "#f8f9fa",
    borderRadius: "4px",
    fontSize: "11px",
    overflow: "auto",
    color: "#666",
  },
};
```

---

## 🧩 Step 2: Extract State Components

```tsx
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
```

```tsx
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
```

```tsx
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
```

---

## 👤 Step 3: Extract UserCard Component (with React.memo)

```tsx
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
```

---

## 📋 Step 4: Extract UserList Component

```tsx
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
```

---

## 🎯 Step 5: Update App.tsx (Clean & Optimized)

```tsx
// ─────────────────────────────────────────────────────────────
// 🎨 Render: Main Content
// ─────────────────────────────────────────────────────────────
// Priority order: loading → error → empty → data
// Never show stale data while loading, always surface
// errors rather than showing a blank unexplained page
return (
  <main style={mainContainer}>
    {loading ? (
      // 🔄 Loading state: API call is in flight
      <LoadingState />
    ) : error ? (
      // ❌ Error state: network failure, API error, expired token etc.
      <ErrorState message={error} />
    ) : users.length === 0 ? (
      // 🕳️ Empty state: request succeeded but no users returned
      <EmptyState />
    ) : (
      // ✅ Success state: render the list of users
      <UserList users={users} />
    )}
  </main>
);
```

**Add imports at the top**:

```tsx
import { LoadingState } from "./components/states/LoadingState";
import { ErrorState } from "./components/states/ErrorState";
import { EmptyState } from "./components/states/EmptyState";
import { UserList } from "./components/UserList";
import { mainContainer } from "./styles/mainStyles";
```

---

## 🗂️ Final File Structure

```bash
src/
├── App.tsx
├── components/
│   ├── UserCard.tsx          # ✅ Memoized user card
│   ├── UserList.tsx          # ✅ User grid wrapper
│   └── states/
│       ├── LoadingState.tsx  # ✅ Loading UI
│       ├── ErrorState.tsx    # ✅ Error UI
│       └── EmptyState.tsx    # ✅ Empty UI
├── styles/
│   └── mainStyles.ts         # ✅ All style constants
├── store/
└── ...
```

---

## 🧪 Optional: CSS Modules Version (Even Better Performance)

If you prefer CSS Modules over JS style objects:

```css
/* src/styles/MainContent.module.css */
.mainContainer {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.loadingState {
  text-align: center;
  padding: 40px;
  color: #666;
}

.loadingState__icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* ... etc ... */
```

```tsx
// Usage in component:
import styles from "./MainContent.module.css";

<div className={styles.mainContainer}>
  <div className={styles.loadingState}>
    <div className={styles.loadingState__icon}>⏳</div>
    <p>Loading users from backend...</p>
  </div>
</div>;
```

**Benefits of CSS Modules**:

- ✅ Zero runtime style computation
- ✅ Better browser caching
- ✅ Easier theming/overrides
- ✅ Smaller JS bundle

---

## 📊 Performance Benefits Summary

| Optimization        | Before                                  | After                                             | Impact                     |
| ------------------- | --------------------------------------- | ------------------------------------------------- | -------------------------- |
| Inline styles       | Recreated every render                  | Reused constants                                  | 🟢 Reduced GC pressure     |
| UserCard re-renders | All cards re-render on any state change | Only changed cards re-render (`React.memo`)       | 🟢 Faster updates          |
| `JSON.stringify`    | Called on every render                  | Memoized, only recalculates if `user.raw` changes | 🟢 Reduced CPU usage       |
| JSX complexity      | ~150 lines in App.tsx                   | ~15 lines in App.tsx                              | 🟢 Easier to read/maintain |
| Testing             | Hard to test inline logic               | Each component testable in isolation              | 🟢 Better test coverage    |

---

## 🧪 Test the Optimized Version

```bash
# Run unit tests
npm test

# Run E2E tests
npx playwright test

# Check bundle size (optional)
npm run build -- --stats
```

✅ **Expected**: All tests pass, app behavior unchanged, better performance.

---

## 🔧 Quick Rollback (If Needed)

If you prefer the original inline version:

```bash
git checkout src/App.tsx
# Or manually revert the changes
```

But the optimized version is **production-ready** and follows React best practices! 🎯

---

## 🎉 Summary

You now have:

- ✅ Clean, readable `App.tsx` (~15 lines for content logic)
- ✅ Reusable, testable components
- ✅ Memoized expensive operations
- ✅ Style constants for consistency
- ✅ Better performance with `React.memo`
- ✅ All original comments preserved
- ✅ Full TypeScript type safety

**Copy-paste the code above** and enjoy a faster, cleaner codebase! 🚀✨

Need help with CSS Modules, styled-components, or Tailwind migration? Just ask! 😊
