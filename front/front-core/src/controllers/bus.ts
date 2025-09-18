
import { type EventBus } from "./types";
import {ActionRegistryImpl} from "./registry";
import { Widget } from "@/plugin";
import { createEvent } from "effector";
import { Action } from "../plugin/types_actions";
import { type ActionRegistry } from "../plugin/types_actions";

export class EventBusImpl implements EventBus,ActionRegistry {
    domain: any;
    name: string;
    registry= new  ActionRegistryImpl();
    present=createEvent<Widget<any>>()

    constructor(domain) {
      this.domain = domain;
    }


    register<P>(action:Action<any>):string { 
        return this.registry.register(action);
    }

    run(actionId:string, params:any): Action<any> | undefined {
        return this.registry.run(actionId, params);
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
  