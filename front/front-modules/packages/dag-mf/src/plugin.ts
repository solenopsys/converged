
import { ACTIONS } from "./helpers";


export class DagPlugin implements Plugin {
    name = "dag";

    constructor(private bus: EventBus) {

    }
    plug(): void {
        ACTIONS.forEach(action => this.bus.registerAction(action));
    }
    unplug(): void {
        ACTIONS.forEach(action => this.bus.unregisterAction(action));
    }
}