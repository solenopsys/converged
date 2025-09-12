 

class ActionRegistry {
  private map = new Map<string, Loader>();
 
  register<P>(action:Action):string { 
  }

  run(actionId:string, params:any): Loader | undefined {
    const action:Action=this.map.get(actionId);
    return action.invoke(params);
  }
}

export const registry = new ActionsRegistry();
