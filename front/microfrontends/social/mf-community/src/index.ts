export const ID = "community-mf";
export { MENU } from "./menu";

import { BasePlugin } from "front-core";
import ACTIONS from "./functions";

export default new BasePlugin(ID, ACTIONS);
