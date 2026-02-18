export const ID = 'dumps-mf';
export { MENU } from "./menu";
import ACTIONS from './functions';
import { BasePlugin } from 'front-core';

export default new BasePlugin(ID, ACTIONS);
