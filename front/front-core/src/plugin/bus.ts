
import { type EventBus } from "./bus";

export class EventBusImpl implements EventBus {
    constructor(domain) {
      this.domain = domain;
      this.name = domain.compositeName.fullName;
    }
  
    // Метод для подписки эффектов на события
    on(event, effect) {
      // Связываем событие с эффектом
      event.watch((payload) => {
        console.log(`[${this.name}] Событие ${event.compositeName.fullName} получено:`, payload);
        effect(payload);
      });
      
      return this; // для цепочки вызовов
    }
  
    // Метод для эмиссии события
    emit(event, payload) {
      console.log(`[${this.name}] Эмитим событие ${event.compositeName.fullName}`);
      event(payload);
      return this;
    }
  }
  