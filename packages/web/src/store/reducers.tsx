import { UnknownAction } from "@reduxjs/toolkit";
import {
  FETCH_USERS_SUCCESS,
  SET_LOADING,
  UserAction,
  FormattedUser,
} from "./actions";

export interface UserState {
  users: FormattedUser[];
  loading: boolean;
}

const initialState: UserState = {
  users: [],
  loading: false,
};

function isUserAction(
  action: UserAction | UnknownAction,
): action is UserAction {
  return action.type === FETCH_USERS_SUCCESS || action.type === SET_LOADING;
}

const userReducer = (
  state: UserState = initialState,
  action: UserAction | UnknownAction,
): UserState => {
  if (!isUserAction(action)) return state;

  switch (action.type) {
    case FETCH_USERS_SUCCESS:
      return { ...state, users: action.payload };
    case SET_LOADING:
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

export default userReducer;
