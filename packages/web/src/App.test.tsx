// App.test.tsx
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import "@testing-library/jest-dom"; // ✅ Extends Jest matchers

import App from "./App";
import userReducer from "./store/reducers"; // ✅ Direct import - adjust if needed
import { UserState } from "./store/reducers"; // ✅ Import state type too

// ─────────────────────────────────────────────────────────────
// 🧪 Types
// ─────────────────────────────────────────────────────────────
interface RootState {
  users: UserState;
}

// ─────────────────────────────────────────────────────────────
// 🧪 Test Store Factory
// ─────────────────────────────────────────────────────────────
function createTestStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: {
      users: userReducer,
    },
    preloadedState,
  });
}

// ─────────────────────────────────────────────────────────────
// 🔌 Mocks
// ─────────────────────────────────────────────────────────────
jest.mock("@demo/common", () => ({
  APP_NAME: "Test App",
  User: {} as any,
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  }),
) as jest.Mock;

// ─────────────────────────────────────────────────────────────
// 🧪 Tests
// ─────────────────────────────────────────────────────────────
describe("App Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders LoginPage when not authenticated", () => {
    const store = createTestStore({
      users: {
        token: null,
        username: null,
        users: [],
        loading: false,
        error: null,
      },
    });

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    // ✅ Adjust selector to match your LoginPage's actual text:
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });
});
