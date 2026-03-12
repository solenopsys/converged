export const ID = "requests-mf";
export { MENU } from "./menu";
import { BasePlugin } from "front-core";
import ACTIONS from "./functions";
import Panel from "./Panel";

export default new BasePlugin(ID, ACTIONS);
export { Panel };
