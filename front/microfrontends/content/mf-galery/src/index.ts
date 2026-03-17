export const ID = "galery-mf";
export { GROUP, MENU } from "./menu";
import ACTIONS from "./functions";
import { BasePlugin } from "front-core";

export default new BasePlugin(ID, ACTIONS);
