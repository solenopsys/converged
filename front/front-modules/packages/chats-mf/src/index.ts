 


export const ID = 'chats-mf';
export * from "./menu";
import ACTIONS from "./functions"; 
import {BasePlugin} from "converged-core";

export default new BasePlugin(ID, ACTIONS)

