import { BasePlugin } from "front-core";
import ACTIONS from "./functions";

export const ID = "functions-mf";
export { FunctionsListView } from "./views/FunctionsListView";
export { SHOW_FUNCTIONS, createShowFunctionsAction } from "./functions";
export { SCREENS } from "./screens";

export default new BasePlugin(ID, ACTIONS);
