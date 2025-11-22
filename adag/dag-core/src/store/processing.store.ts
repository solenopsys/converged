import { KVStore, generateULID } from "back-core";
import { StringHash } from "dag-api";

const CONTEXT = "context";
const EXECUTION = "execution";

export class ExecutionAccessor {
  constructor(
    private db: KVStore,
    private store: ProcessingStore,
  ) {}

  start(nodeHash: StringHash, data?: any): string {
    const key = this.db.put(
      [EXECUTION, nodeHash, generateULID(), "start"],
      data,
    );
    return key;
  }

  end(key: string, data?: any) {
    return this.db.put([key, "end"], data);
  }

  error(key: string, error: { code: number; message: string }) {
    return this.db.put([key, "error"], error);
  }
}

export class ContextAccessor {
  constructor(
    private db: KVStore,
    private store: ProcessingStore,
  ) {}

  createContext(workflowHash: StringHash, meta?: any): string {
    const key = this.db.put([CONTEXT, workflowHash, generateULID()], {
      created_at: new Date(),
      meta,
    });
    return key;
  }

  addDataToContext(contextKey: string, key: string, value: any) {
    this.db.put([contextKey, key], value);
  }

  getContext(contextKey: string): any {
    return this.db.getVeluesRangeAsObjectWithPrefix(contextKey);
  }
}

export class ProcessingStore {
  public readonly executions: ExecutionAccessor;
  public readonly contexts: ContextAccessor;

  constructor(private kvStore: KVStore) {
    this.executions = new ExecutionAccessor(kvStore, this);
    this.contexts = new ContextAccessor(kvStore, this);
  }

  async deinit() {
    await this.kvStore.close();
  }
}
