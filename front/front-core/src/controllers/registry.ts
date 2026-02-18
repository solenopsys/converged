

import {  ActionRegistry  } from "./types";
import { Action } from "../plugin/types_actions";


export class ActionRegistryImpl implements ActionRegistry{
  private map = new Map<string, Action<any>>();

  register<P>(action:Action<any>):string {
    this.map.set(action.id, action);
     return action.id;
  }

  run(actionId:string, params:any): Action<any> | undefined {
     const action:Action<any>=this.map.get(actionId);
    return action.invoke(params);
  }

  getAll(): Action<any>[] {
    return Array.from(this.map.values());
  }

  getAllIds(): string[] {
    return Array.from(this.map.keys());
  }

  get(actionId: string): Action<any> | undefined {
    return this.map.get(actionId);
  }
}

// Singleton instance
export const registry = new ActionRegistryImpl();
