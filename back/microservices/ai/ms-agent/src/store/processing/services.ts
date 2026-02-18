import type { KVStore } from "back-core";
import type { LoopStateData } from "./entities";

export class ProcessingStoreService {
  constructor(private store: KVStore) {}

  saveLoopState(sessionId: string, state: LoopStateData): void {
    this.store.put(["loop", sessionId], state);
  }

  getLoopState(sessionId: string): LoopStateData | undefined {
    return this.store.get(["loop", sessionId]);
  }

  deleteLoopState(sessionId: string): void {
    this.store.delete(["loop", sessionId]);
  }
}
