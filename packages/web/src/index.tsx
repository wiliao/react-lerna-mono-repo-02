import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import store from "./store";
import ErrorBoundary from "./ErrorBoundary";

// ─────────────────────────────────────────────────────────────
// 🌳 DOM Entry Point
// ─────────────────────────────────────────────────────────────
// document.getElementById("root") finds the <div id="root"> in index.html.
// This is the single DOM node React "mounts" into — React owns everything
// inside it, and the rest of the HTML file is just a shell.
const container = document.getElementById("root");

// ✅ Fail fast with a clear message if the root element is missing.
// Without this check, createRoot(null) would throw a cryptic React error
// that's much harder to diagnose, especially for beginners.
if (!container) {
  throw new Error(
    "Root element not found. Make sure index.html has a <div id='root'>.",
  );
}

// ─────────────────────────────────────────────────────────────
// ⚛️ React 18+ Rendering API
// ─────────────────────────────────────────────────────────────
// createRoot() is the React 18+ way to mount an app (replaces ReactDOM.render).
// It enables concurrent features like automatic batching, transitions, and
// Suspense improvements that weren't available in React 17 and below.
const root = createRoot(container);

root.render(
  // ─────────────────────────────────────────────────────────────
  // 🔍 React.StrictMode
  // ─────────────────────────────────────────────────────────────
  // StrictMode is a development-only tool (no impact on production builds).
  // It intentionally double-invokes renders and effects to help surface:
  //   - Impure render functions (renders should be side-effect free)
  //   - Missing useEffect cleanup functions
  //   - Deprecated API usage
  // If you see useEffect running twice in dev, this is why — it's intentional.
  <React.StrictMode>
    <ErrorBoundary>
      {/* ✅ catches render crashes in any child */}
      {/* ───────────────────────────────────────────────────────
          🏪 Redux Provider
          ───────────────────────────────────────────────────────
          Provider makes the Redux store available to every component
          in the tree via React Context — without it, useSelector and
          useDispatch would throw errors because they can't find the store.
          The store only needs to be passed once here at the root;
          no need to prop-drill it down to individual components. */}
      <Provider store={store}>
        {/* App is the root component — the entire component tree lives here */}
        <App />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
);
