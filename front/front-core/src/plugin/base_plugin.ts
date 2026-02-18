import { Plugin } from "../controllers/types";
import { type ActionRegistry } from "../controllers/types";

export class BasePlugin implements Plugin {
    bus: ActionRegistry;
    

    constructor(public name: string,private actions: any[]){}

    plug(bus: ActionRegistry){
        this.bus = bus;
        this.actions.forEach(action => bus.register(action(bus)));
    }

    unplug(): void {
        this.actions.forEach(action => this.bus.register(action(this.bus)));
    }
    
}
