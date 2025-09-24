import { BasePlugin } from 'converged-core';

export * from './functions'; 
export * from './config';
export {MENU} from './menu';


export const ID = 'layouts-mf';
import ACTIONS from './functions'; 

export default new BasePlugin(ID, ACTIONS)

 