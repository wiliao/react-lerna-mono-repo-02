import { createStore, applyMiddleware, combineReducers } from "redux";
import { thunk } from "redux-thunk";
import userReducer from "./reducers";

const rootReducer = combineReducers({
  users: userReducer,
  loading: userReducer,
});

// Note: Redux 5 prefers configureStore (from Redux Toolkit),
// but createStore works for this basic demo setup.
const store = createStore(rootReducer, applyMiddleware(thunk));

export default store;
