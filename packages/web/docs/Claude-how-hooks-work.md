# How Hooks Work

There are four hooks used across this codebase — two from React and two from Redux:

---

**`useEffect`** — runs side effects after render

```typescript
useEffect(() => {
  dispatch(fetchUsers());
}, [dispatch]);
```

A "side effect" is anything that reaches outside the component — API calls, timers, subscriptions. React's render function must be pure (no side effects), so `useEffect` gives you a safe place to run them _after_ the component renders. The second argument is the dependency array — the effect re-runs whenever a value in that array changes. An empty `[]` means "run once after the first render only", which is the equivalent of `componentDidMount` in class components. `dispatch` is included because the rules of hooks require all referenced values to be listed, but since Redux guarantees `dispatch` is a stable reference that never changes, it effectively never triggers a re-run.

---

**`useState`** — not used here, but worth understanding why

Your component has no local state at all — `users`, `loading`, and `error` all live in Redux. `useState` would be the right choice for UI-only state that doesn't need to be shared (e.g. an input field value, a toggle, a modal open/close). The rule of thumb is: if only one component needs it, use `useState`. If multiple components need it, use Redux.

---

**`useDispatch`** — sends actions to the Redux store

```typescript
const dispatch = useDispatch<AppDispatch>();
```

`dispatch` is the only way to trigger a state change in Redux. You call it with an action (or a thunk) and Redux routes it through the reducer. Typing it as `AppDispatch` is important — without it, TypeScript doesn't know dispatch can accept thunk functions, only plain action objects, and would show a type error when you call `dispatch(fetchUsers())`.

---

**`useSelector`** — reads state from the Redux store

```typescript
const { users, loading, error } = useSelector(
  (state: RootState) => state.users,
);
```

`useSelector` takes a selector function that receives the entire Redux state tree and returns the slice you care about. It's a live subscription — whenever the selected slice changes, React automatically re-renders the component with the new values. The `RootState` type tells TypeScript the exact shape of the state tree so you get full autocomplete and type safety. One performance note: `useSelector` uses strict reference equality (`===`) to decide whether to re-render. Returning a new object literal inside the selector like `state => ({ users: state.users.users })` would cause a re-render on every dispatch even if the data didn't change — selecting a stable slice like `state.users` directly avoids this.

---

**How they connect together in this app:**

```typescript
useEffect fires once on mount
  → useDispatch sends fetchUsers() thunk to Redux
    → thunk dispatches SET_LOADING, fetches API, dispatches FETCH_USERS_SUCCESS
      → reducer updates store state
        → useSelector detects change, triggers re-render
          → component renders the updated users list
```

Each hook has a single responsibility, and together they form the complete cycle from "component mounts" to "data appears on screen".
