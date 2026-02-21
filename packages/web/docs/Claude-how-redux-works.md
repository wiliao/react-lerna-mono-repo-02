# React + Redux: Complete Summary

> Lerna Monorepo Demo — `packages/web/src`

---

## Project Structure

```typescript
packages/web/src/
├── index.tsx          # App entry point — mounts React, provides Redux store
├── App.tsx            # Root component — reads state, dispatches actions
└── store/
    ├── index.tsx      # Store configuration + TypeScript types
    ├── actions.tsx    # Action constants, interfaces, thunk (fetchUsers)
    └── reducers.tsx   # Pure reducer — how state changes in response to actions
```

---

## Core Redux Concepts

### 1. Single Source of Truth

The entire app's state lives in one object inside the store. No state scattered across components.

### 2. State is Read-Only

You can never modify state directly. The only way to change state is to dispatch an action.

```typescript
// ❌ Never do this
state.users = [];

// ✅ Only way to change state
dispatch({ type: FETCH_USERS_SUCCESS, payload: [] });
```

### 3. Actions — "What Happened"

Plain objects with a `type` field and optional `payload`. Just descriptions — they don't do anything themselves.

```typescript
{ type: "SET_LOADING",         payload: true            }
{ type: "FETCH_USERS_SUCCESS", payload: [Alice, Bob]    }
{ type: "SET_ERROR",           payload: "API error 500" }
```

### 4. Reducers — "What To Do About It"

A pure function: `(currentState, action) => newState`. Never mutates — always returns a new object.

```typescript
case FETCH_USERS_SUCCESS:
  return { ...state, users: action.payload }; // spread = new object

case SET_LOADING:
  return { ...state, loading: action.payload };

case SET_ERROR:
  return { ...state, error: action.payload };
```

**Pure means:** same inputs → same output. No API calls, no random values, no mutations.

### 5. Thunks — Async Actions

Plain Redux is synchronous. Thunks allow action creators to return a _function_ instead of an object, giving you a place to do async work before dispatching real actions.

```typescript
export const fetchUsers = () => {
  return async (dispatch: Dispatch) => {
    // ← returns a function, not an object
    dispatch({ type: SET_LOADING, payload: true });
    dispatch({ type: SET_ERROR, payload: null });
    try {
      const response = await fetch("http://localhost:4000/api/users");
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      dispatch({ type: FETCH_USERS_SUCCESS, payload: data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      dispatch({ type: SET_ERROR, payload: message });
    } finally {
      dispatch({ type: SET_LOADING, payload: false }); // always clears spinner
    }
  };
};
```

---

## State Shape

```typescript
// UserState — the "users" slice of the Redux store
interface UserState {
  users: FormattedUser[]; // fetched from GET /api/users
  loading: boolean; // true while request is in flight
  error: string | null; // error message, or null if none
}

// Initial state — before any actions are dispatched
const initialState: UserState = {
  users: [],
  loading: false,
  error: null,
};
```

---

## Complete Data Flow

```typescript
User interaction / useEffect
        │
        ▼
   dispatch(fetchUsers())     ← the only entry point to change state
        │
        ▼
   Thunk middleware            ← intercepts functions, runs async logic
        │
        ▼
   Reducer(state, action)     ← pure function, returns NEW state object
        │
        ▼
   Store updates              ← new state stored
        │
        ▼
   useSelector notifies       ← all subscribers re-evaluated
        │
        ▼
   Component re-renders       ← UI reflects new state
```

### Step-by-step on page load

```typescript
1.  index.tsx mounts React into <div id="root">
2.  Redux store created: { users:[], loading:false, error:null }
3.  <Provider> makes store available to all components
4.  <App> renders for the first time → shows "No users found."
5.  useEffect fires → dispatch(fetchUsers())
6.  SET_LOADING true  → state.loading = true  → spinner shown
7.  SET_ERROR null    → state.error = null    → clear previous errors
8.  await fetch("http://localhost:4000/api/users")
        ├── success → FETCH_USERS_SUCCESS → state.users = [Alice, Bob]
        └── failure → SET_ERROR "message" → state.error = "API error: 500"
9.  SET_LOADING false → state.loading = false → spinner hidden
10. useSelector detects change → App re-renders → list (or error) shown
```

---

## React Hooks Used

| Hook          | Purpose                                            |
| ------------- | -------------------------------------------------- |
| `useEffect`   | Run side effects (API calls) after render          |
| `useSelector` | Read state from Redux store, re-renders on change  |
| `useDispatch` | Get the dispatch function to send actions to Redux |

```typescript
// useDispatch — typed as AppDispatch so TypeScript accepts thunks
const dispatch = useDispatch<AppDispatch>();

// useSelector — live subscription, re-renders when selected slice changes
const { users, loading, error } = useSelector(
  (state: RootState) => state.users,
);

// useEffect — runs once on mount ([] = no dependencies that change)
useEffect(() => {
  dispatch(fetchUsers());
}, [dispatch]);
```

---

## Render Priority in App.tsx

Always handle all four states — never show a blank page:

```typescript
{loading ? (
  <p>Loading users from backend...</p>        // 1. spinner
) : error ? (
  <p style={{ color: "red" }}>⚠️ {error}</p> // 2. error message
) : users.length === 0 ? (
  <p>No users found.</p>                       // 3. empty state
) : (
  <ul>...</ul>                                 // 4. success
)}
```

---

## TypeScript Exports from Store

```typescript
// store/index.tsx

// RootState: shape of the entire state tree — inferred automatically
export type RootState = ReturnType<typeof store.getState>;
// Usage: useSelector((state: RootState) => state.users)

// AppDispatch: type of dispatch — needed to accept thunks
export type AppDispatch = typeof store.dispatch;
// Usage: useDispatch<AppDispatch>()
```

---

## Key Best Practices Applied

- **`response.ok` check** — `fetch()` only rejects on network failure, not on 4xx/5xx. Always check `response.ok` manually.
- **`SET_ERROR` action** — never silently swallow errors; dispatch them to state so the UI can render them.
- **`finally` block** — guarantees `SET_LOADING false` runs whether the API call succeeded or failed.
- **`key={user.raw.id}`** — use a stable unique ID as React list key, never array index.
- **Import `FormattedUser` from `actions.tsx`** — one source of truth; don't redefine the same interface in multiple files.
- **`useDispatch<AppDispatch>()`** — typed dispatch so TypeScript accepts thunk action creators.
- **Spread operator in reducers** — `{ ...state, users: action.payload }` creates a new object; never mutate state directly.

---

## Why These Constraints Matter

| Constraint               | Benefit                                                  |
| ------------------------ | -------------------------------------------------------- |
| One-way data flow        | Easy to trace bugs — data always moves in one direction  |
| Pure reducers            | Testable with no mocking — just `reducer(state, action)` |
| Immutable state          | Enables time-travel debugging in Redux DevTools          |
| Actions as plain objects | Serializable — can be logged, replayed, and persisted    |
| Thunks for async         | Keeps reducers pure — all side effects in one place      |
