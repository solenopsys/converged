import { StorageConnection } from "bun-transport";
import { KVStore } from "../engines/kv/kv-store";
import { SqlStore } from "../engines/sql/sql-store";
import { FileStore } from "../engines/files/file-store";
import { ColumnStore } from "../engines/column/column-store";
import { VectorStore } from "../engines/vector/vector-store";
import { StoreType } from "./types";
import { Store } from "./types";
import { Migration } from "../migrations";

const STORAGE_SOCKET_PATH =
  process.env.STORAGE_SOCKET_PATH || "/tmp/storage.sock";

const STORE_DEBUG_ENABLED =
  process.env.STORE_DEBUG === "1" ||
  process.env.STORE_DEBUG === "true" ||
  process.env.NODE_ENV === "development";

function logStoreDebug(message: string, meta?: Record<string, unknown>) {
  if (!STORE_DEBUG_ENABLED) return;
  if (meta) {
    console.log(`[stores] ${message}`, meta);
    return;
  }
  console.log(`[stores] ${message}`);
}

function elapsedMs(startedAt: number): number {
  return Date.now() - startedAt;
}

function createStore(
  conn: StorageConnection,
  msName: string,
  storeDir: string,
  type: StoreType,
  migrations: (new (store: Store) => Migration)[],
): Store {
  logStoreDebug("prepare", { msName, store: storeDir, type });

  if (type === StoreType.KVS) {
    return new KVStore(conn, msName, storeDir, migrations);
  }
  if (type === StoreType.SQL) {
    return new SqlStore(conn, msName, storeDir, migrations);
  }
  if (type === StoreType.FILES) {
    return new FileStore(conn, msName, storeDir, migrations);
  }
  if (type === StoreType.COLUMN) {
    return new ColumnStore(conn, msName, storeDir, migrations);
  }
  if (type === StoreType.VECTOR) {
    return new VectorStore(conn, msName, storeDir, migrations);
  }

  throw new Error(`Store type ${type} not implemented`);
}

export abstract class StoreControllerAbstract {
  protected stores: { [key: string]: Store } = {};
  protected conn: StorageConnection;

  constructor(protected msName: string) {
    this.conn = new StorageConnection(STORAGE_SOCKET_PATH);
  }

  abstract init(): Promise<void>;
  abstract destroy(): Promise<void>;

  async startAll() {
    for (const [name, store] of Object.entries(this.stores)) {
      const startedAt = Date.now();
      logStoreDebug("open:start", { msName: this.msName, store: name });
      try {
        await store.open();
        logStoreDebug("open:done", {
          msName: this.msName,
          store: name,
          durationMs: elapsedMs(startedAt),
        });
      } catch (error) {
        logStoreDebug("open:failed", {
          msName: this.msName,
          store: name,
          durationMs: elapsedMs(startedAt),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }

  async closeAll() {
    for (const [name, store] of Object.entries(this.stores)) {
      const startedAt = Date.now();
      logStoreDebug("close:start", { msName: this.msName, store: name });
      try {
        await store.close();
        logStoreDebug("close:done", {
          msName: this.msName,
          store: name,
          durationMs: elapsedMs(startedAt),
        });
      } catch (error) {
        logStoreDebug("close:failed", {
          msName: this.msName,
          store: name,
          durationMs: elapsedMs(startedAt),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
    this.conn.close();
  }

  async migrateAll() {
    for (const [name, store] of Object.entries(this.stores)) {
      const startedAt = Date.now();
      logStoreDebug("migrate:start", { msName: this.msName, store: name });
      try {
        await store.migrate();
        logStoreDebug("migrate:done", {
          msName: this.msName,
          store: name,
          durationMs: elapsedMs(startedAt),
        });
      } catch (error) {
        logStoreDebug("migrate:failed", {
          msName: this.msName,
          store: name,
          durationMs: elapsedMs(startedAt),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }

  async addStore(
    name: string,
    type: StoreType,
    migrations: (new (store: Store) => Migration)[],
  ): Promise<Store> {
    this.stores[name] = createStore(this.conn, this.msName, name, type, migrations);
    return this.stores[name];
  }
}

export { createStore };
