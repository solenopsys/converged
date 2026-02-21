import { generateULID } from "back-core";
import type { NodeProcessor } from "./node-processor";

export type SessionStatus = "running" | "done" | "failed";

export type SessionRecord = {
  id: string;
  name: string;
  status: SessionStatus;
  data: Record<string, any>;
  error?: string;
  startedAt: number;
  updatedAt: number;
};

export class Session {
  public readonly id: string;
  private record: SessionRecord;

  constructor(
    private processor: NodeProcessor,
    name: string,
    private store: Map<string, SessionRecord>,
  ) {
    this.id = generateULID();
    this.record = {
      id: this.id,
      name,
      status: "running",
      data: {},
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    store.set(this.id, this.record);
  }

  async run(code: string, input: any): Promise<any> {
    const event = await this.processor.run(code, input);
    this.record.updatedAt = Date.now();

    if (event.type === "error") {
      this.record.status = "failed";
      this.record.error = event.error;
      throw new Error(event.error);
    }

    return event.result;
  }

  set(key: string, value: any) {
    this.record.data[key] = value;
    this.record.updatedAt = Date.now();
  }

  get(key: string): any {
    return this.record.data[key];
  }

  done() {
    this.record.status = "done";
    this.record.updatedAt = Date.now();
  }

  fail(error: string) {
    this.record.status = "failed";
    this.record.error = error;
    this.record.updatedAt = Date.now();
  }
}

export class SessionStore {
  private sessions = new Map<string, SessionRecord>();

  create(processor: NodeProcessor, name: string): Session {
    return new Session(processor, name, this.sessions);
  }

  get(id: string): SessionRecord | undefined {
    return this.sessions.get(id);
  }

  list(): SessionRecord[] {
    return Array.from(this.sessions.values());
  }
}
