# Mental Model

Here's the complete data flow from page load to rendered UI:

```typescript
┌─────────────────────────────────────────────────────────────┐
│                        index.tsx                            │
│                                                             │
│  1. React mounts into <div id="root">                       │
│  2. Redux store is created (users:[], loading:false,        │
│     error:null)                                             │
│  3. <Provider> makes store available to all components      │
│  4. <App> renders for the first time                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                         App.tsx                             │
│                                                             │
│  5. useSelector reads initial state:                        │
│       users=[], loading=false, error=null                   │
│  6. Renders empty state: "No users found."                  │
│  7. useEffect fires after first render →                    │
│       dispatch(fetchUsers())                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                       actions.tsx                           │
│                    fetchUsers() thunk                       │
│                                                             │
│  8.  dispatch SET_LOADING true                              │
│  9.  dispatch SET_ERROR null   (clear previous errors)      │
│  10. await fetch("http://localhost:4000/api/users")         │
│                                                             │
│         ┌─── success ──────────┬─── failure ───────┐       │
│         │                      │                   │       │
│         ▼                      │                   ▼       │
│  11a. response.ok?             │           11b. dispatch   │
│       dispatch                 │               SET_ERROR   │
│       FETCH_USERS_SUCCESS      │               "message"   │
│       payload: FormattedUser[] │                   │       │
│         │                      │                   │       │
│         └──────────────────────┴───────────────────┘       │
│                                │                           │
│  12. finally: dispatch SET_LOADING false                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      reducers.tsx                           │
│                                                             │
│  13. Each dispatched action flows through userReducer:      │
│                                                             │
│      SET_LOADING true  → state.loading = true               │
│      SET_ERROR null    → state.error   = null               │
│                                                             │
│      on success:                                            │
│      FETCH_USERS_SUCCESS → state.users = [Alice, Bob]       │
│                                                             │
│      on failure:                                            │
│      SET_ERROR "msg"   → state.error = "API error: 500"     │
│                                                             │
│      SET_LOADING false → state.loading = false              │
│                                                             │
│  ✅ Each case returns a NEW object — state is never mutated │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  store/index.tsx                            │
│                                                             │
│  14. Store notifies all useSelector subscribers             │
│      that state has changed                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   App.tsx re-renders                        │
│                                                             │
│  15. useSelector returns updated state                      │
│  16. Render priority:                                       │
│                                                             │
│      loading=true  → "Loading users from backend..."        │
│      error≠null    → "⚠️ API error: 500 ..."               │
│      users=[]      → "No users found."                      │
│      users=[...]   → <ul> with Alice, Bob                   │
└─────────────────────────────────────────────────────────────┘
```

**The key mental models to take away:**

**One-way data flow** — data always moves in one direction: `component → action → reducer → store → component`. You never modify state directly from a component.

**Actions are just descriptions** — `{ type: "SET_LOADING", payload: true }` is just a plain object describing _what happened_. The reducer decides _what to do about it_.

**Reducers are pure functions** — same input always produces same output, no side effects. This is what makes Redux state predictable and time-travel debugging possible.

**Thunks bridge async and Redux** — Redux reducers are synchronous by design. Thunks (`fetchUsers`) are where all async work (API calls, timers) happens _before_ dispatching plain actions to the reducer.

**useSelector is a live subscription** — it doesn't just read state once; it re-renders the component automatically whenever the selected slice of state changes.
