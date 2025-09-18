export const ID = 'dag-mf';
export {MENU} from './menu';
import {ACTIONS} from './functions';
import { BasePlugin } from "converged-core";
export default new BasePlugin(ID, ACTIONS) 