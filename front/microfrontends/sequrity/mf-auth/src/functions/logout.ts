import type { CreateAction } from "front-core";
import { logoutPressed } from "../model";

export const LOGOUT = "auth.logout";

export const createLogoutAction: CreateAction<any> = () => ({
  id: LOGOUT,
  description: "Logout user",
  invoke: () => logoutPressed(),
});
