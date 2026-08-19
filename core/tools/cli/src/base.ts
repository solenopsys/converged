export abstract class BaseCommandProcessor {
  protected client: any;
  protected paramSplitter: string;
  protected commandMap: Map<string, CommandEntry>;

  constructor(client: any, paramSplitter: string = "=") {
    this.client = client;
    this.paramSplitter = paramSplitter;
    this.commandMap = this.initializeCommandMap();
  }

  protected abstract initializeCommandMap(): Map<string, CommandEntry>;

  get commands(): string[] {
    return [...this.commandMap.keys()];
  }

  /** Name + description of every command — the descriptions the listing prints. */
  get catalog(): Array<{ command: string; description: string }> {
    return [...this.commandMap].map(([command, { description }]) => ({ command, description }));
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

    // Errors travel up to the runner, which owns reporting and the exit code:
    // exiting here would skip the closing of the channel and the run's summary.
    try {
      await entry.handler(this.client, this.paramSplitter, param);
    } catch (error: any) {
      if (error?.statusCode === 401) {
        throw new Error("Unauthorized — sign in with `bun cli auth login` or set SERVICE_TOKEN");
      }
      throw error;
    }
  }
}

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
