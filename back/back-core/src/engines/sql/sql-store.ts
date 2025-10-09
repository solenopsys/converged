import { Store } from "../../stores";
import { Kysely, SelectQueryBuilder, UpdateQueryBuilder, DeleteQueryBuilder } from "kysely";
import { Migration } from "../../migrations";   
import { MigrationStateStorage, Migrator } from "../../migrations";
import { SqliteDialect } from "kysely";
import { Database } from "bun:sqlite";
import path from "path";
import { BunSqliteDialect } from 'kysely-bun-sqlite'; // нужен этот пакет!


export class SqlStore<DB = any> implements Store {
  private kysely: Kysely<DB> | null = null;

  constructor(
    private dataLocation: string,  
    private migrations: (new (store:Store) => Migration)[],
    private migrationsState: MigrationStateStorage
  ) {
    
  }

  // Применяет WHERE условия через reduce
  public applyWhereConditions<T extends string>(
    query: SelectQueryBuilder<DB, T, any> | UpdateQueryBuilder<DB, T, any, any> | DeleteQueryBuilder<DB, T, any>,
    conditions: Record<string, any>
  ) {
    return Object.entries(conditions).reduce(
      (q, [key, value]) => q.where(key as any, '=', value),
      query
    );
  }

  // Доступ к оригинальному Kysely если нужно
  get db() {
    if (!this.kysely) {
      throw new Error('Database not initialized. Call open() first.');
    }
    return this.kysely;
  }

  async open(): Promise<void> {
    if (this.kysely) {
      return;
    }
  
    console.log(`Opening database at WALL ${this.dataLocation}`);
    
    const database = new Database(this.dataLocation);
    
    // КРИТИЧНО для параллельных запросов:
    database.exec("PRAGMA journal_mode = WAL;");           // Разрешает одновременное чтение/запись
    database.exec("PRAGMA busy_timeout = 5000;");          // Ждёт 5 сек вместо immediate fail
    database.exec("PRAGMA synchronous = NORMAL;");         
    database.exec("PRAGMA cache_size = -64000;");          
    database.exec("PRAGMA temp_store = MEMORY;");

    console.log("journal_mode:", database.query("PRAGMA journal_mode;").get());
    console.log("synchronous:", database.query("PRAGMA synchronous;").get());
    console.log("busy_timeout:", database.query("PRAGMA busy_timeout;").get());
    
    
    this.kysely = new Kysely<DB>({
      dialect: new BunSqliteDialect({
        database
      })
    });
  }

  async close(): Promise<void> {
    if (this.kysely) {
      await this.kysely.destroy();
      this.kysely = null;
    }
  }

  async migrate(): Promise<void> { // todo move to superclass


    const migrations = this.migrations.map((migrationWrap) => new migrationWrap(this));
    const migrator = new Migrator(migrations, this.migrationsState);
    await migrator.up();
  }
}