import { type ProvidersStore } from 'dag-api';

import { IndexStore } from './index.store';
import { SchemeStore } from './scheme.store';
import { ProcessStore } from './process.store';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { Database } from 'bun:sqlite';
import { SqliteDialect } from 'kysely';
import { Kysely } from 'kysely';

class StoreController implements ProvidersStore {
  private static instance: StoreController;

  public readonly indexStore: IndexStore;
  public readonly schemeStore: SchemeStore;
  public readonly processStore: ProcessStore;

  private constructor() {
    const dataDir = process.env.DATA_DIR || './data';
    mkdirSync(dataDir, { recursive: true });

    const index = new Kysely({
      dialect: new SqliteDialect({
        database: new Database(join(dataDir, 'index.sqlite'))
      })
    });

    this.indexStore = new IndexStore(index);
    this.schemeStore = new SchemeStore(dataDir);
    this.processStore = new ProcessStore(dataDir);
  }

  public static getInstance(): StoreController {
    if (!StoreController.instance) {
      StoreController.instance = new StoreController();
    }
    return StoreController.instance;
  }
}