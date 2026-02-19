import { FETCH_USERS_SUCCESS, SET_LOADING } from "./actions";

const initialState = {
  users: [],
  loading: false,
};

const userReducer = (state = initialState, action) => {
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
