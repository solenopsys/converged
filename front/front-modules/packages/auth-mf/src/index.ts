export * from "./menu";
export const ID = 'auth-mf';
import { BasePlugin } from "converged-core";
import { ACTIONS } from "./functions";

export default new BasePlugin(ID, ACTIONS)