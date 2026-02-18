import {
  HashString,
  PaginatedResult,
  PaginationParams,
  StoreService,
  CompressionType,
} from "g-store";
import { StoresController } from "./stores";
import * as path from "path";

const MS_ID = "store-ms";

export class StoreServiceImpl implements StoreService {
  stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  private buildHash(data: Uint8Array): HashString {
    // Use SHA-256 for cryptographic hash
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(data);
    return hasher.digest("hex");
  }

  private toKey(hash: HashString): string {
    const prefix = hash.slice(0, 3);
    return path.join(prefix, hash);
  }

  async save(
    data: Uint8Array,
    originalSize?: number,
    compression?: CompressionType,
    owner?: string,
  ): Promise<HashString> {
    const hash = this.buildHash(data);
    await this.stores.fileStore.put(this.toKey(hash), data);
    await this.stores.metadataService.save(
      hash,
      data.length,
      originalSize ?? data.length,
      compression ?? "none",
      owner ?? "",
    );
    return hash;
  }

  async saveWithHash(
    hash: HashString,
    data: Uint8Array,
    originalSize?: number,
    compression?: CompressionType,
    owner?: string,
  ): Promise<HashString> {
    await this.stores.fileStore.put(this.toKey(hash), data);
    await this.stores.metadataService.save(
      hash,
      data.length,
      originalSize ?? data.length,
      compression ?? "none",
      owner ?? "",
    );
    return hash;
  }

  async delete(hash: HashString): Promise<void> {
    // Уменьшаем счетчик ссылок, удаляем файл только если больше нет ссылок
    const shouldDelete = await this.stores.metadataService.decrementRef(hash);
    if (shouldDelete) {
      await this.stores.fileStore.delete(this.toKey(hash));
    }
  }

  async get(hash: HashString): Promise<Uint8Array> {
    const data = await this.stores.fileStore.get(this.toKey(hash));
    if (!data) {
      throw new Error(`Chunk not found: ${hash}`);
    }
    return data;
  }

  async getWithMeta(hash: HashString): Promise<{
    data: Uint8Array;
    compression: CompressionType;
    originalSize: number;
  }> {
    const data = await this.stores.fileStore.get(this.toKey(hash));
    if (!data) {
      throw new Error(`Chunk not found: ${hash}`);
    }
    const meta = await this.stores.metadataService.get(hash);
    return {
      data,
      compression: meta?.compression ?? "none",
      originalSize: meta?.originalSize ?? data.length,
    };
  }

  async exists(hash: HashString): Promise<boolean> {
    return this.stores.fileStore.exists(this.toKey(hash));
  }

  async list(params: PaginationParams): Promise<PaginatedResult<HashString>> {
    const allKeys = await this.stores.fileStore.listKeys();
    const start = params.offset;
    const end = params.offset + params.limit;
    return {
      items: allKeys.slice(start, end).map((key) => path.basename(key)),
      totalCount: allKeys.length,
    };
  }

  async storeStatistic(): Promise<any> {
    return this.stores.fileStore.getStats();
  }
}
