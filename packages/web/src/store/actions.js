export const FETCH_USERS_SUCCESS = "FETCH_USERS_SUCCESS";
export const SET_LOADING = "SET_LOADING";

export const fetchUsers = () => {
  return async (dispatch) => {
    dispatch({ type: SET_LOADING, payload: true });

    try {
      const response = await fetch("http://localhost:4000/api/users");
      const data = await response.json();

      dispatch({ type: FETCH_USERS_SUCCESS, payload: data });
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      dispatch({ type: SET_LOADING, payload: false });
    }
  };
};
