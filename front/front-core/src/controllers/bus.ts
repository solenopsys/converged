
import { type EventBus } from "./types";
import { Widget } from "@/plugin";
import { createEvent } from "effector";
import { Action } from "../plugin/types_actions";
import { type ActionRegistry } from "../controllers/types";
import { presentEvent ,runActionEvent,registerActionEvent} from "./effector-integration";

export class EventBusImpl implements EventBus,ActionRegistry {
    domain: any;
    name: string;
    present=({widget,params}: {widget:Widget<any>,params?:any})=>presentEvent({widget,params})

    constructor(domain) {
      this.domain = domain;
    }


    register<P>(action:Action<any>):string {
         registerActionEvent(action);
         return action.id;
    }

    run(actionId:string, params:any):   undefined {
         runActionEvent({actionId, params});
    }




    // Метод для подписки эффектов на события
    on(event: any, effect: any) {
      // Связываем событие с эффектом
      event.watch((payload) => {
        console.log(`[${this.name}] Событие ${event} получено:`, payload);
        effect(payload);
      });

      return this; // для цепочки вызовов
    }

    // Метод для эмиссии события
    emit(event: any, payload: any) {
      console.log(`[${this.name}] Эмитим событие ${event}`);
      event(payload);
      return this;
    }
  }

// Global bus singleton
import { createDomain } from "effector";
const globalDomain = createDomain("global-bus");
export const bus = new EventBusImpl(globalDomain);
