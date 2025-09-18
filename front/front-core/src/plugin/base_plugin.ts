import { Plugin } from "../controllers/types";
import { type EventBus } from "../controllers/bus";

export class BasePlugin implements Plugin {
    bus: EventBus;
    

    constructor(public name: string,private actions: any[]){}

    plug(bus: EventBus){
        this.bus = bus;
        this.actions.forEach(action => bus.registerAction(action(bus)));
    }

    unplug(): void {
        this.actions.forEach(action => this.bus.unregisterAction(action(this.bus)));
    }
    
}
