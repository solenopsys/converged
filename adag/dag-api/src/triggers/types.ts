// Событие - носитель данных
interface TriggerEvent {
    readonly type: string;
    readonly timestamp: Date;
    readonly source: string;
    readonly payload: Record<string, any>;
    readonly correlationId?: string;
  }
  
 
// общий контракт для всех триггеров
interface Trigger<TPayload = unknown> {
  /** Уникальный идентификатор триггера */
  id: string;

  /** Человекочитаемое имя для UI */
  name: string;

  /** Тип триггера: "cron", "webhook", "file", "queue", "manual" и т.п. */
  type: string;

  /** Параметры конфигурации (зависит от типа) */
  config: Record<string, any>;

  /** Инициализация — готовит ресурсы */
  init(): Promise<void>;

  /** Запуск прослушивания события */
  start(callback: (payload: TPayload) => Promise<void> | void): Promise<void>;

  /** Остановка прослушивания */
  stop(): Promise<void>;
}



class Trigger {
  constructor(
    private id: string,
    private provider: EventProvider,
    private filter: any
  ) {}

  start(handler: (event: any) => void) {
    this.provider.register(this.id, this.filter, handler);
  }
}
export {Trigger,TriggerEvent}