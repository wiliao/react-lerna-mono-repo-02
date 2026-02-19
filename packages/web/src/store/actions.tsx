import { Dispatch } from "redux";
import { User } from "@demo/common";

export const FETCH_USERS_SUCCESS = "FETCH_USERS_SUCCESS";
export const SET_LOADING = "SET_LOADING";

export interface FormattedUser {
  raw: User;
  formatted: string;
}

interface FetchUsersSuccessAction {
  type: typeof FETCH_USERS_SUCCESS;
  payload: FormattedUser[];
}

interface SetLoadingAction {
  type: typeof SET_LOADING;
  payload: boolean;
}

export type UserAction = FetchUsersSuccessAction | SetLoadingAction;

export const fetchUsers = () => {
  return async (dispatch: Dispatch<UserAction>) => {
    dispatch({ type: SET_LOADING, payload: true });

    try {
      const response = await fetch("http://localhost:4000/api/users");
      const data: FormattedUser[] = await response.json();
      dispatch({ type: FETCH_USERS_SUCCESS, payload: data });
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      dispatch({ type: SET_LOADING, payload: false });
    }
  };
};
