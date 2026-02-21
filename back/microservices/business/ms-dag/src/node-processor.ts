import { generateULID } from "back-core";

export type NodeState = "new" | "start" | "end" | "err";

export type NodeRecord = {
  id: string;
  code: string;
  state: NodeState;
  data: any;
  result?: any;
  error?: string;
  ts: number;
};

export type NodeProcessorEvent =
  | { type: "done"; id: string; result: any }
  | { type: "error"; id: string; error: string };

type NodeHandler = (input: any) => Promise<any>;

export class NodeProcessor {
  private nodes = new Map<string, NodeHandler>();
  private records = new Map<string, NodeRecord>();

  register(code: string, handler: NodeHandler) {
    this.nodes.set(code, handler);
  }

  // При старте сбрасываем все зависшие в err
  resetStale() {
    for (const record of this.records.values()) {
      if (record.state === "new" || record.state === "start") {
        record.state = "err";
        record.error = "stale: processor restarted";
      }
    }
  }

  async run(code: string, data: any): Promise<NodeProcessorEvent> {
    const id = generateULID();

    const record: NodeRecord = {
      id,
      code,
      state: "new",
      data,
      ts: Date.now(),
    };
    this.records.set(id, record);

    const handler = this.nodes.get(code);
    if (!handler) {
      record.state = "err";
      record.error = `node not found: ${code}`;
      return { type: "error", id, error: record.error };
    }

    record.state = "start";

    try {
      const result = await handler(data);
      record.state = "end";
      record.result = result;
      return { type: "done", id, result };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      record.state = "err";
      record.error = error;
      return { type: "error", id, error };
    }
  }

  getRecord(id: string): NodeRecord | undefined {
    return this.records.get(id);
  }

  getLogs(): NodeRecord[] {
    return Array.from(this.records.values());
  }
}
