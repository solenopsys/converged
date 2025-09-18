 
 
import { Action, ActionRegistry  } from "../plugin/types_actions";


export class ActionRegistryImpl implements ActionRegistry{
  private map = new Map<string, Action<any>>();
 
  register<P>(action:Action<any>):string { 
    this.map.set(action.id, action);
    console.log("Registered action:", action.id," - " ,action.description)
    return action.id;
  }

  run(actionId:string, params:any): Action<any> | undefined {
    const action:Action<any>=this.map.get(actionId);
    return action.invoke(params);
  }
}

