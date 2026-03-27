import { BasePlugin } from "front-core";

export {
  SHOW_DASHBOARD,
  REGISTER_DASHBOARD_WIDGET,
  createDashboardLayoutWidget,
  createDashboardMountAction,
} from "./functions";
export { MENU } from "./menu";
export { DashboardLayout } from "./components/DashboardLayout";

export const ID = "dasboards-mf";
import ACTIONS from "./functions";

export default new BasePlugin(ID, ACTIONS);
