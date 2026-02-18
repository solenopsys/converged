import { KVStore } from "../engines/kv/kv-store";
import { SqlStore } from "../engines/sql/sql-store";
import { FileStore } from "../engines/files/file-store";
import { ColumnStore } from "../engines/column/column-store";
import { VectorStore } from "../engines/vector/vector-store";
import { join } from "path";
import { StoreType } from "./types";
import { DATA_DIR } from "./types";
import { Store } from "./types";
import { ManifestStorage } from "./manifest";
import { Migration } from "../migrations";
const DB_NAME = "data";
import { mkdirSync } from "fs";


function dbExt(type: StoreType): string {
  if (type === StoreType.KVS) return ".lmdb";
  if (type === StoreType.SQL) return ".db";
  if (type === StoreType.COLUMN) return ".db";
  if (type === StoreType.VECTOR) return ".db";
  if (type === StoreType.FILES) return ""; // директория, не файл
  return "";
}

async function createStore(
  msName: string,
  storeDir: string,
  type: StoreType,
  migrations: (new (store: Store) => Migration)[],
): Promise<Store> {
  const storeDirectory = join(DATA_DIR, msName, storeDir);
  mkdirSync(storeDirectory, { recursive: true });

  const ext = dbExt(type);
  const fullName = DB_NAME + ext;

  // Для FILES хранилища dataLocation - это директория data внутри storeDirectory
  const dataLocation =
    type === StoreType.FILES
      ? join(storeDirectory, DB_NAME)
      : join(storeDirectory, fullName);

  const manifest = {
    name: storeDir,
    dataLocation: dataLocation,
    version: "1",
    type: type,
    migrations: [],
  };

  const manifestStorage = new ManifestStorage(storeDirectory);

  manifestStorage.createIfNeeded(manifest);

  if (type === StoreType.KVS) {
    return new KVStore(manifest.dataLocation, migrations, manifestStorage);
  }

  if (type === StoreType.SQL) {
    return new SqlStore(manifest.dataLocation, migrations, manifestStorage);
  }

  if (type === StoreType.FILES) {
    // Для файлового хранилища dataLocation - это директория
    return new FileStore(manifest.dataLocation, migrations, manifestStorage);
  }

  if (type === StoreType.COLUMN) {
    return new ColumnStore(manifest.dataLocation, migrations, manifestStorage);
  }

  if (type === StoreType.VECTOR) {
    return new VectorStore(
      manifest.dataLocation,
      migrations,
      manifestStorage,
    );
  }

  throw new Error(`Store type ${type} not implemented`);
}

export abstract class StoreControllerAbstract {
  protected stores: { [key: string]: Store } = {};

  constructor(protected msName: string) {
    this.msName = msName;
  }

  abstract init(): Promise<void>;
  abstract destroy(): Promise<void>;

  async startAll() {
    for (const store of Object.values(this.stores)) {
      await store.open();
    }
  }

  async closeAll() {
    for (const store of Object.values(this.stores)) {
      await store.close();
    }
  }

  async migrateAll() {
    for (const store of Object.values(this.stores)) {
      await store.migrate();
    }
  }

  async addStore(
    name: string,
    type: StoreType,
    migrations: (new (store: Store) => Migration)[],
  ): Promise<Store> {
    this.stores[name] = await createStore(this.msName, name, type, migrations);
    return this.stores[name];
  }
}

export { createStore };
