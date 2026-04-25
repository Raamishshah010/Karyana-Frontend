import { createSlice } from "@reduxjs/toolkit";
import { ROLES } from "../../utils";
let admin = sessionStorage.getItem("karyana-admin");
admin = admin ? JSON.parse(admin) : null;
export const authSlice = createSlice({
  name: "admin",
  initialState: {
    isAuthenticated: admin ? true : false,
    token: admin ? admin.token : null,
    user: admin ? admin.user : null,
    role: admin ? admin.role : ROLES[0],
  },
  reducers: {
    authHandler: (state, action) => {
      return action.payload;
    },
  },
});

export const { authHandler } = authSlice.actions;

export default authSlice.reducer;
