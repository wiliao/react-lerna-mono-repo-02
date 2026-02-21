import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./reducers";

// ─────────────────────────────────────────────────────────────
// 🏪 Redux Store Configuration
// ─────────────────────────────────────────────────────────────
// The store is the single source of truth for the entire app's state.
// All state lives here — components read from it and dispatch actions to change it.
const store = configureStore({
  reducer: {
    // ✅ Each key here becomes a "slice" of the global state tree.
    // e.g. store.getState().users → returns UserState { users[], loading, error }
    users: userReducer,
  },
});

// ─────────────────────────────────────────────────────────────
// 📐 TypeScript Type Exports
// ─────────────────────────────────────────────────────────────

// RootState: the shape of the entire Redux state tree.
// ReturnType<typeof store.getState> automatically infers it from the reducers —
// no need to maintain this manually as new slices are added.
// Usage in components: const users = useSelector((state: RootState) => state.users)
export type RootState = ReturnType<typeof store.getState>;

// AppDispatch: the type of the dispatch function.
// Needed so TypeScript knows dispatch can handle thunks (async actions).
// Usage in components: const dispatch = useDispatch<AppDispatch>()
export type AppDispatch = typeof store.dispatch;

export default store;
