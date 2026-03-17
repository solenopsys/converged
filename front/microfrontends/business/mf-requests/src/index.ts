export const ID = "requests-mf";
export { GROUP, MENU } from "./menu";
import { BasePlugin } from "front-core";
import ACTIONS from "./functions";
import Panel from "./Panel";

export default new BasePlugin(ID, ACTIONS);
export { Panel };
