import { KVStore, generateULID } from "back-core";
import {
  ContextKey,
  ContextRepository,
  ContextValue,
  PersistentKey,
  PersistentRepository,
  PersistentValue,
} from "./entities";

/**
 * KV-хранилище состояния воркфлоу.
 *
 * Хранит:
 * - context: мета воркфлоу (id, время создания, входные параметры)
 * - step cache: workflowId:nodeName -> nodeRecordId (ссылка на запись в NodeProcessor/SQL)
 * - persistent: долгоживущие данные узлов между запусками
 */
export class ProcessingStoreService {
  private readonly contextRepo: ContextRepository;
  private readonly persistentRepo: PersistentRepository;

  constructor(private kvStore: KVStore) {
    this.contextRepo = new ContextRepository(kvStore);
    this.persistentRepo = new PersistentRepository(kvStore);
  }

  // ============ Workflow context ============

  createContext(workflowId: string, meta?: any): string {
    const contextId = generateULID();
    const key = new ContextKey(workflowId, contextId);
    const value: ContextValue = { createdAt: new Date().toISOString(), meta };
    return this.contextRepo.save(key, value);
  }

  // ============ Step cache ============
  // Хранит nodeRecordId — ссылку на запись в SQL (store/stats)

  getStep(workflowId: string, nodeName: string): string | undefined {
    return this.kvStore.getDirect(`${workflowId}:${nodeName}`) as string | undefined;
  }

  setStep(workflowId: string, nodeName: string, nodeRecordId: string): void {
    this.kvStore.put([workflowId, nodeName], nodeRecordId);
  }

  setStatus(workflowId: string, status: string): void {
    this.kvStore.put([workflowId, "__status__"], status);
  }

  // ============ Persistent ============

  set<T = any>(key: string, value: T): void {
    this.persistentRepo.save(new PersistentKey(key), value);
  }

  get<T = any>(key: string): T | undefined {
    return this.persistentRepo.get(new PersistentKey(key)) as T | undefined;
  }

  delete(key: string): void {
    this.persistentRepo.delete(new PersistentKey(key));
  }

  listVars(): { key: string; value: any }[] {
    const keys = this.persistentRepo.listKeys();
    return keys.map((rawKey) => {
      const key = rawKey.replace(/^persistent:/, "");
      return { key, value: this.persistentRepo.getDirect(rawKey) };
    });
  }
}

export type { ContextValue, PersistentValue };
