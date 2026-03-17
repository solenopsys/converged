export const ID = "charts-mf";
export { GROUP, MENU } from "./menu";

import { BasePlugin } from "front-core";
import ACTIONS from "./functions";

export default new BasePlugin(ID, ACTIONS);
