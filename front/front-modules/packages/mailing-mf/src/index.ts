
export const ID = 'mailing-mf';
export * from "./menu";
import {ACTIONS} from "./functions/index"; 
import {BasePlugin} from "converged-core";

export default new BasePlugin(ID, ACTIONS)