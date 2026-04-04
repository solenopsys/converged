import { KVStore, generateULID } from "back-core";
import {
  ContextKey,
  ContextRepository,
  ContextValue,
  PersistentKey,
  PersistentRepository,
  PersistentValue,
  RecordKey,
  RecordRepository,
  type RecordValue,
} from "./entities";

/**
 * KV-хранилище состояния воркфлоу.
 *
 * Хранит:
 * - context: мета воркфлоу (id, время создания, входные параметры)
 * - step cache: workflowId:nodeName -> nodeRecordId
 * - record: данные ноды по recordId (data, result)
 * - persistent: vars между запусками
 */
export class ProcessingStoreService {
  private static readonly JSON_HEADER = "KVJ0";
  private static readonly BUFFER_HEADER = "KVB0";
  private static readonly HEADER_LENGTH = 4;
  private static readonly MAX_TEXT_PREVIEW = 2048;

  private readonly contextRepo: ContextRepository;
  private readonly persistentRepo: PersistentRepository;
  private readonly recordRepo: RecordRepository;

  constructor(private kvStore: KVStore) {
    this.contextRepo = new ContextRepository(kvStore);
    this.persistentRepo = new PersistentRepository(kvStore);
    this.recordRepo = new RecordRepository(kvStore);
  }

  // ============ Workflow context ============

  createContext(workflowId: string, meta?: any): string {
    const contextId = generateULID();
    const key = new ContextKey(workflowId, contextId);
    const value: ContextValue = { createdAt: new Date().toISOString(), meta };
    return this.contextRepo.save(key, value);
  }

  // ============ Node records ============

  setRecord(recordId: string, value: RecordValue): void {
    this.recordRepo.save(new RecordKey(recordId), value);
  }

  getRecord(recordId: string): RecordValue | undefined {
    return this.recordRepo.get(new RecordKey(recordId));
  }

  // ============ Step cache ============
  // Хранит recordId — ссылку на запись в KVS (recordRepo)

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
      const rawValue = this.kvStore.getRawDirect(rawKey);
      return { key, value: this.buildVarPreview(rawValue) };
    });
  }

  private buildVarPreview(rawValue: Buffer | null): any {
    if (!rawValue) {
      return undefined;
    }

    if (rawValue.length < ProcessingStoreService.HEADER_LENGTH) {
      return this.truncateText(rawValue.toString("utf8"));
    }

    const header = rawValue.subarray(0, ProcessingStoreService.HEADER_LENGTH).toString("utf8");
    const payload = rawValue.subarray(ProcessingStoreService.HEADER_LENGTH);

    if (header === ProcessingStoreService.BUFFER_HEADER) {
      return `[binary ${payload.length} bytes]`;
    }

    if (header === ProcessingStoreService.JSON_HEADER) {
      if (payload.length > ProcessingStoreService.MAX_TEXT_PREVIEW) {
        return this.truncateBuffer(payload);
      }
      const text = payload.toString("utf8");
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return this.truncateBuffer(rawValue);
  }

  private truncateText(text: string): string {
    if (text.length <= ProcessingStoreService.MAX_TEXT_PREVIEW) {
      return text;
    }
    return `${text.slice(0, ProcessingStoreService.MAX_TEXT_PREVIEW)}… [truncated ${text.length} chars]`;
  }

  private truncateBuffer(buffer: Buffer): string {
    if (buffer.length <= ProcessingStoreService.MAX_TEXT_PREVIEW) {
      return buffer.toString("utf8");
    }
    const preview = buffer
      .subarray(0, ProcessingStoreService.MAX_TEXT_PREVIEW)
      .toString("utf8");
    return `${preview}… [truncated ${buffer.length} bytes]`;
  }
}

export type { ContextValue, PersistentValue };
