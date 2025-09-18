
export const ID = 'mailing-mf';
export * from "./menu";
export {ACTIONS} from "./functions"; 
import {BasePlugin} from "converged-core";

export default new BasePlugin(ID, ACTIONS)