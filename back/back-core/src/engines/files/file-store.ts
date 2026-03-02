import { StorageConnection } from "bun-transport";
import { Store } from "../../stores";
import { Migration, Migrator } from "../../migrations";
import { TransportMigrationStateStorage } from "../transport/transport-driver";

export type FileKey = string;

export class FileStore implements Store {
  constructor(
    private conn: StorageConnection,
    private ms: string,
    private storeName: string,
    private migrations: (new (store: Store) => Migration)[],
  ) {}

  async open(): Promise<void> {
    this.conn.open(this.ms, this.storeName, "files");
  }

  async close(): Promise<void> {
    this.conn.close_store(this.ms, this.storeName);
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

  async get(key: FileKey): Promise<Uint8Array | undefined> {
    const buf = this.conn.fileGet(this.ms, this.storeName, key);
    return buf ? new Uint8Array(buf) : undefined;
  }

  exists(key: FileKey): boolean {
    return this.conn.fileGet(this.ms, this.storeName, key) !== null;
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
