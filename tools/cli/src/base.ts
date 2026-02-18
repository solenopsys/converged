// Абстрактный суперкласс
export abstract class BaseCommandProcessor {
  protected client: any;
  protected paramSplitter: string;
  protected commandMap: Map<string, Handler>;

  constructor(client: any, paramSplitter: string = "=") {
    this.client = client;
    this.paramSplitter = paramSplitter;
    this.commandMap = this.initializeCommandMap();
  }

  // Абстрактный метод - должен быть переопределен в наследниках
  protected abstract initializeCommandMap(): Map<string, Handler>;

  get commands(): string[] {
    return [...this.commandMap.keys()];
  }

  async processCommand(command: string, param?: string): Promise<void> {
    const handler = this.commandMap.get(command);

    if (!handler) {
      console.log("commands: ", [...this.commandMap.keys()]);
      return;
    }

    try {
      await handler(this.client, this.paramSplitter, param);
    } catch (error) {
      console.error(`Error processing command '${command}':`, error);
      throw error;
    }
  }
}

// Интерфейс для handler функций
export interface Handler {
  (client: any, paramSplitter: string, param?: string): Promise<void>;
}
