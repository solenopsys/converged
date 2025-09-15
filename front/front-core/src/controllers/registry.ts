 
 
import { Action } from "../types_actions";

class ActionRegistry {
  private map = new Map<string, Action<any, any>>();
 
  register<P>(action:Action<any, any>):string { 
    this.map.set(action.id, action);
    console.log("Registered action:", action.id," - " ,action.description)
    return action.id;
  }

  run(actionId:string, params:any): Action<any, any> | undefined {
    const action:Action<any, any>=this.map.get(actionId);
    return action.invoke(params);
  }
}

export const registry = new ActionRegistry();
