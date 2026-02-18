import { Store } from "../../stores";
import {
  Kysely,
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from "kysely";
import { Migration, Migrator, MigrationStateStorage } from "../../migrations";
import { SqliteVecDatabase } from "bun-vector";
import { BunSqliteDialect } from "kysely-bun-sqlite";

export class VectorStore<DB = any> implements Store {
  private kysely: Kysely<DB> | null = null;
  private sqlite: SqliteVecDatabase | null = null;

  constructor(
    private dataLocation: string,
    private migrations: (new (store: Store) => Migration)[],
    private migrationsState: MigrationStateStorage,
  ) {}

  public applyWhereConditions<T extends string>(
    query:
      | SelectQueryBuilder<DB, T, any>
      | UpdateQueryBuilder<DB, T, any, any>
      | DeleteQueryBuilder<DB, T, any>,
    conditions: Record<string, any>,
  ) {
    return Object.entries(conditions).reduce(
      (q, [key, value]) => q.where(key as any, "=", value),
      query,
    );
  }

  get db() {
    if (!this.kysely) {
      throw new Error("Database not initialized. Call open() first.");
    }
    return this.kysely;
  }

  get raw() {
    if (!this.sqlite) {
      throw new Error("Database not initialized. Call open() first.");
    }
    return this.sqlite;
  }

  async open(): Promise<void> {
    if (this.kysely) {
      return;
    }

    const database = new SqliteVecDatabase(this.dataLocation);

    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA busy_timeout = 10000;");
    database.exec("PRAGMA synchronous = NORMAL;");
    database.exec("PRAGMA cache_size = -64000;");
    database.exec("PRAGMA temp_store = MEMORY;");
    database.exec("PRAGMA trusted_schema = ON;");

    this.sqlite = database;

    this.kysely = new Kysely<DB>({
      dialect: new BunSqliteDialect({
        database,
      }),
    });
  }

  async close(): Promise<void> {
    if (this.kysely) {
      await this.kysely.destroy();
      this.kysely = null;
    }

    if (this.sqlite) {
      this.sqlite.close();
      this.sqlite = null;
    }
  }

  async migrate(): Promise<void> {
    const migrations = this.migrations.map((migration) => new migration(this));
    const migrator = new Migrator(migrations, this.migrationsState);
    await migrator.up();
  }

  searchByVector(
    table: string,
    vectorColumn: string,
    queryVector: number[],
    limit: number,
  ): Array<{ rowid: number; distance: number }> {
    const stmt = this.raw.prepare(
      `SELECT rowid, distance FROM vec_${table}
       WHERE ${vectorColumn} MATCH ?
       ORDER BY distance
       LIMIT ?`,
    );
    return stmt.all(JSON.stringify(queryVector), limit) as Array<{
      rowid: number;
      distance: number;
    }>;
  }
}
