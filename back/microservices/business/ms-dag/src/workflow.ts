import { generateULID } from "back-core";
import type { KVStore } from "back-core";

export type WorkflowStatus = "running" | "done" | "failed";

export abstract class Workflow {
  readonly id: string;

  constructor(private kv: KVStore, id?: string) {
    this.id = id ?? generateULID();
    if (!id) {
      this.kv.put([this.id, "__status__"], "running" satisfies WorkflowStatus);
    }
  }

  protected async invoke<T = any>(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.kv.getDirect(`${this.id}:${key}`);
    if (cached !== undefined) return cached as T;
    const result = await fn();
    this.kv.put([this.id, key], result);
    return result;
  }

  async start(params: any): Promise<void> {
    try {
      await this.execute(params);
      this.kv.put([this.id, "__status__"], "done" satisfies WorkflowStatus);
    } catch (e) {
      this.kv.put([this.id, "__status__"], "failed" satisfies WorkflowStatus);
      throw e;
    }
  }

  abstract execute(params: any): Promise<void>;
}
