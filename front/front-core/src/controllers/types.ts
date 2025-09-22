import { type } from "os";
import { Widget } from "../plugin/types_actions";
import { Action } from "../plugin/types_actions";
import { any } from "zod";

interface EventBus extends ActionRegistry{
    present({widget ,params}: {widget: Widget<any>,params?:any} ): void;
    emit(event: string, data: any): void;
  
}

interface ActionRegistry {
    register(action: Action<any>): void;
    run(actionId: string, params: any): Action<any> | undefined;
}

interface Plugin {
    name: string;
    plug(bus: EventBus): void;
    unplug(): void;
}


interface View   { 
}
    




export type {Plugin, EventBus, View,ActionRegistry}