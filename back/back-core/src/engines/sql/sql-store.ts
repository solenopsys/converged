import { Store } from "../../stores";
import { Kysely, SelectQueryBuilder, UpdateQueryBuilder, DeleteQueryBuilder } from "kysely";
import { Migration } from "../../migrations";   
import { MigrationStateStorage, Migrator } from "../../migrations";
import { SqliteDialect } from "kysely";
import { Database } from "bun:sqlite";
import path from "path";

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
      return; // Уже открыта
    }

 
    console.log(`Opening database at ${this.dataLocation}`);
    
    this.kysely = new Kysely<DB>({
      dialect: new SqliteDialect({
        database: new Database(this.dataLocation)
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


    const migrations = this.migrations.map((migration) => new migration(this));
    const migrator = new Migrator(migrations, this.migrationsState);
    await migrator.up();
  }
}