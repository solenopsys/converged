import type { CreateAction } from "front-core";
import { logoutPressed } from "../model";

export const LOGOUT = "auth.logout";

export const createLogoutAction: CreateAction<any> = () => ({
  id: LOGOUT,
  llm: {
    microfrontend: "auth-mf",
    brief: "llm.actions.auth_logout.brief",
    description: "llm.actions.auth_logout.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => logoutPressed(),
});
