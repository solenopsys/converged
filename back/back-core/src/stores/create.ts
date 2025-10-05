import { KVStore } from "../engines/kv/kv-store";
import { SqlStore } from "../engines/sql/sql-store";
import { join } from "path"; 
import { StoreType } from "./types";
import { DATA_DIR } from "./types"; 
import {Store} from "./types";
import {ManifestStorage} from "./manifest";
import {Migration} from "../migrations";
const DB_NAME="datatabase";
import { mkdirSync } from "fs";


async function createStore(msName: string, storeDir: string, type: StoreType, migrations: (new (store: Store) => Migration)[]): Promise<Store> {
  const storeDirectory = join(DATA_DIR, msName, storeDir);
  mkdirSync(storeDirectory, { recursive: true });
  
  const manifest =  {
    name: msName,
    dataLocation: join(storeDirectory,DB_NAME),
    version: "1",
    type: type,
    migrations: []
  };

   const manifestStorage = new ManifestStorage(storeDirectory);

  manifestStorage.createIfNeeded(manifest);
  

  if (type === StoreType.KVS ) {
    return new KVStore(manifest.dataLocation,migrations ,manifestStorage);
  }

  if (type === StoreType.SQL ) {
    return new SqlStore(manifest.dataLocation,migrations,manifestStorage);
  }
  
  throw new Error(`Store type ${type} not implemented`);
}

export abstract class StoreControllerAbstract {
  protected stores: { [key: string]: Store  } = {};


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

  async addStore(name:string, type:StoreType, migrations: (new (store: Store) => Migration)[]): Promise<Store> {
      this.stores[name] = await createStore(this.msName, name, type,migrations);
      return this.stores[name];
  }
}

export { createStore };