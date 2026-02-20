// Абстрактный суперкласс
export abstract class BaseCommandProcessor {
  protected client: any;
  protected paramSplitter: string;
  protected commandMap: Map<string, CommandEntry>;

  constructor(client: any, paramSplitter: string = "=") {
    this.client = client;
    this.paramSplitter = paramSplitter;
    this.commandMap = this.initializeCommandMap();
  }

  // Абстрактный метод - должен быть переопределен в наследниках
  protected abstract initializeCommandMap(): Map<string, CommandEntry>;

  get commands(): string[] {
    return [...this.commandMap.keys()];
  }

  async processCommand(command: string, param?: string): Promise<void> {
    const entry = this.commandMap.get(command);

    if (!entry) {
      const nameWidth = Math.max(...[...this.commandMap.keys()].map((k) => k.length), 4);
      console.log("Available commands:\n");
      console.log(`  ${"name".padEnd(nameWidth)}  description`);
      console.log(`  ${"─".repeat(nameWidth)}  ${"─".repeat(40)}`);
      for (const [name, { description }] of this.commandMap) {
        console.log(`  ${name.padEnd(nameWidth)}  ${description}`);
      }
      return;
    }

    try {
      await entry.handler(this.client, this.paramSplitter, param);
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

export interface CommandEntry {
  handler: Handler;
  description: string;
}

export function printJson(value: any): void {
  console.log(Bun.inspect(value, { colors: true, depth: 10 }));
}
