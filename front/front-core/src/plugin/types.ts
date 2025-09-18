import { type } from "os";
import { Widget } from "./types_actions";

interface EventBus{
    present(widget: Widget ): void;
    emit(event: string, data: any): void;
    registerAction(ac)
}

interface Plugin {
    name: string;
    plug(bus: EventBus): void;
    unplug(): void;
}





export type {Plugin, EventBus}