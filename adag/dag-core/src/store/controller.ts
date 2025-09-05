import { type ProvidersStore } from 'dag-api';

import { IndexStore } from './old/index.store';
import { SchemeStore } from './scheme.store';
import { ProcessStore } from './old/process.store';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { Database } from 'bun:sqlite';
import { SqliteDialect } from 'kysely';
import { Kysely } from 'kysely';

class StoreController  {
  private static instance: StoreController;

  public readonly index: IndexStore;
  public readonly scheme: SchemeStore;
  public readonly process: ProcessStore;

  private constructor() {
    const dataDir = process.env.DATA_DIR || './data';
    mkdirSync(dataDir, { recursive: true });

    const indexOrm = new Kysely({
      dialect: new SqliteDialect({
        database: new Database(join(dataDir, 'index.sqlite'))
      })
    });

   // this.index = new IndexStore(indexOrm);
    this.scheme = new SchemeStore(dataDir);
   // this.process = new ProcessStore(dataDir);
  }

  public static getInstance(): StoreController {
    if (!StoreController.instance) {
      StoreController.instance = new StoreController();
    }
    return StoreController.instance;
  }
}

export { StoreController };