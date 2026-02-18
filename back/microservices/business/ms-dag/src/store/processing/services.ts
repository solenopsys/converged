import { KVStore, generateULID } from "back-core";
import {
  ContextKey,
  ContextRepository,
  ContextValue,
  MessageKey,
  MessageRepository,
  MessageValue,
  MessageStatus,
  AspectKey,
  AspectRepository,
  AspectValue,
  AspectPhase,
  PersistentKey,
  PersistentRepository,
  PersistentValue,
  MESSAGE_PREFIX,
  ASPECT_PREFIX,
  CONTEXT_PREFIX,
} from "./entities";

export class ProcessingStoreService {
  public readonly contextRepo: ContextRepository;
  public readonly messageRepo: MessageRepository;
  public readonly aspectRepo: AspectRepository;
  public readonly persistentRepo: PersistentRepository;

  // Backward compatibility aliases
  public readonly contexts: ProcessingStoreService;
  public readonly messages: ProcessingStoreService;
  public readonly aspects: ProcessingStoreService;
  public readonly persistent: ProcessingStoreService;

  constructor(private kvStore: KVStore) {
    this.contextRepo = new ContextRepository(kvStore);
    this.messageRepo = new MessageRepository(kvStore);
    this.aspectRepo = new AspectRepository(kvStore);
    this.persistentRepo = new PersistentRepository(kvStore);

    // Self-references for backward compatibility
    this.contexts = this;
    this.messages = this;
    this.aspects = this;
    this.persistent = this;
  }

  // ============ Context methods ============
  createContext(workflowHash: string, meta?: any): string {
    const contextId = generateULID();
    const key = new ContextKey(workflowHash, contextId);
    const value: ContextValue = {
      createdAt: new Date().toISOString(),
      meta,
    };
    return this.contextRepo.save(key, value);
  }

  getContext(contextKey: string): any {
    return this.kvStore.getVeluesRangeAsObjectWithPrefix(contextKey);
  }

  getContextMeta(contextKey: string): any {
    return this.kvStore.getDirect(contextKey);
  }

  addDataToContext(contextKey: string, dataKey: string, value: any): void {
    this.kvStore.put([contextKey, dataKey], value);
  }

  // ============ Message methods ============
  emit(contextKey: string, type: string, payload?: any, meta?: any): MessageValue {
    const id = generateULID();
    const key = new MessageKey(contextKey, id);
    const value: MessageValue = {
      id,
      type,
      payload,
      status: "queued",
      ts: new Date().toISOString(),
      meta,
    };
    this.messageRepo.save(key, value);
    return value;
  }

  getMessage(contextKey: string, messageId: string): MessageValue | undefined {
    return this.messageRepo.get(new MessageKey(contextKey, messageId));
  }

  updateMessage(contextKey: string, messageId: string, patch: Partial<MessageValue>): MessageValue | undefined {
    const key = new MessageKey(contextKey, messageId);
    const current = this.messageRepo.get(key);
    if (!current) return undefined;
    const updated: MessageValue = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.messageRepo.save(key, updated);
    return updated;
  }

  setStatus(contextKey: string, messageId: string, status: MessageStatus): void {
    this.updateMessage(contextKey, messageId, { status });
  }

  list(contextKey: string): MessageValue[] {
    const list = this.kvStore.getValuesRangeAsArrayByPrefixChain([contextKey, MESSAGE_PREFIX]) as MessageValue[];
    return (list ?? []).sort((a, b) => a.id.localeCompare(b.id));
  }

  listByStatus(contextKey: string, status: MessageStatus): MessageValue[] {
    return this.list(contextKey).filter((m) => m.status === status);
  }

  listUnacked(contextKey: string): MessageValue[] {
    return this.list(contextKey).filter((m) => m.status !== "done");
  }

  // ============ Aspect methods ============
  start(contextKey: string, aspect: string, data?: any): string {
    const id = generateULID();
    const key = new AspectKey(contextKey, id, "start");
    const value: AspectValue = {
      id,
      aspect,
      phase: "start",
      ts: new Date().toISOString(),
      data,
    };
    this.aspectRepo.save(key, value);
    return id;
  }

  end(contextKey: string, id: string, aspect: string, data?: any): void {
    const key = new AspectKey(contextKey, id, "end");
    const value: AspectValue = {
      id,
      aspect,
      phase: "end",
      ts: new Date().toISOString(),
      data,
    };
    this.aspectRepo.save(key, value);
  }

  error(contextKey: string, id: string, aspect: string, errorMsg: string): void {
    const key = new AspectKey(contextKey, id, "error");
    const value: AspectValue = {
      id,
      aspect,
      phase: "error",
      ts: new Date().toISOString(),
      error: errorMsg,
    };
    this.aspectRepo.save(key, value);
  }

  listAspects(contextKey: string): AspectValue[] {
    return this.kvStore.getValuesRangeAsArrayByPrefixChain([contextKey, ASPECT_PREFIX]) as AspectValue[];
  }

  // ============ Persistent methods ============
  set<T = any>(key: string, value: T): void {
    this.persistentRepo.save(new PersistentKey(key), value);
  }

  get<T = any>(key: string): T | undefined {
    return this.persistentRepo.get(new PersistentKey(key)) as T | undefined;
  }

  delete(key: string): void {
    this.persistentRepo.delete(new PersistentKey(key));
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  listPersistent(): PersistentValue[] {
    return this.persistentRepo.listValues();
  }

  listPersistentKeys(): string[] {
    return this.persistentRepo.listKeys();
  }
}

export type { MessageStatus, MessageValue, AspectPhase, AspectValue, ContextValue, PersistentValue };
