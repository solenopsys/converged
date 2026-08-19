import { BasePlugin } from "front-core/core";
import ACTIONS from "./functions";

export const ID = "static-mf";
export { MENU } from "./menu";
export { SCREENS } from "./screens";

export default new BasePlugin(ID, ACTIONS);
