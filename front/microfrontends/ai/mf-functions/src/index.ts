export const ID = "functions-mf";
export { FunctionsListView } from "./views/FunctionsListView";
export { SHOW_FUNCTIONS, createShowFunctionsAction } from "./functions";

import ACTIONS from "./functions";
import { BasePlugin } from "front-core";

export default new BasePlugin(ID, ACTIONS);
