import { StorageConnection } from "bun-transport";
import { Store } from "../../stores";
import { Migration, Migrator } from "../../migrations";
import { TransportMigrationStateStorage } from "../transport/transport-driver";
import { createBunRedisCache } from "../../server/bunRedisCache";

export type FileKey = string;
export type FileRef = { cacheKey: string };

const fileCache = createBunRedisCache({
  keyPrefix: process.env.VALKEY_KEY_PREFIX || "cache",
  defaultTtlSeconds: 60,
});

export class FileStore implements Store {
  constructor(
    private conn: StorageConnection,
    private ms: string,
    private storeName: string,
    private migrations: (new (store: Store) => Migration)[],
  ) {}

  async open(): Promise<void> {
    this.conn.open(this.ms, this.storeName);
  }

  async close(): Promise<void> {
    // Transport stores are shared by all clients of the storage process.
    // A service shutdown must not close the global store.
  }

  async migrate(): Promise<void> {
    const stateStorage = new TransportMigrationStateStorage(
      this.conn,
      this.ms,
      this.storeName,
    );
    const migrations = this.migrations.map((M) => new M(this));
    const migrator = new Migrator(migrations, stateStorage);
    await migrator.up();
  }

  async put(key: FileKey, data: Uint8Array): Promise<void> {
    this.conn.filePut(this.ms, this.storeName, key, Buffer.from(data));
  }

  /**
   * Materializes the file in scoped Valkey. The file store transport returns
   * only this reference; consumers that need bytes read them from Valkey.
   */
  async get(key: FileKey): Promise<FileRef | undefined> {
    const cacheKey = this.conn.fileGetToCache(this.ms, this.storeName, key);
    return cacheKey ? { cacheKey } : undefined;
  }

  async read(key: FileKey): Promise<Uint8Array | undefined> {
    const ref = await this.get(key);
    if (!ref) return undefined;
    return (await fileCache.getBytes(ref.cacheKey)) ?? undefined;
  }

  exists(key: FileKey): boolean {
    return this.conn.fileGetToCache(this.ms, this.storeName, key) !== null;
  }

  async delete(key: FileKey): Promise<boolean> {
    return this.conn.fileDelete(this.ms, this.storeName, key);
  }

  async listKeys(): Promise<FileKey[]> {
    return this.conn.fileList(this.ms, this.storeName);
  }

  async getStats(): Promise<FileStoreStats> {
    return {
      totalFiles: 0,
      totalSize: 0,
      prefixStats: {},
      basePath: "",
    };
  }
}

export interface FileStoreStats {
  totalFiles: number;
  totalSize: number;
  prefixStats: Record<string, { count: number; size: number }>;
  basePath: string;
}
