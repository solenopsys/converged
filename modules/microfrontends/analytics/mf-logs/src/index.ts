export const ID = "logs-mf";
import ACTIONS from "./functions";
import { BasePlugin } from "front-core";
import "./workspace.css";

export { SCREENS } from "./screens";

export default new BasePlugin(ID, ACTIONS);
