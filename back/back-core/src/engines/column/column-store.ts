import { Store } from "../../stores";
import {
  Kysely,
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from "kysely";
import { Migration, Migrator, MigrationStateStorage } from "../../migrations";
import { StanchionDatabase } from "bun-stanchion";
import { BunSqliteDialect } from "kysely-bun-sqlite";

export class ColumnStore<DB = any> implements Store {
  private kysely: Kysely<DB> | null = null;
  private sqlite: StanchionDatabase | null = null;

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

    const database = new StanchionDatabase(this.dataLocation, {
      strict: true,
      create: true,
    });
    this.sqlite = database;

    // Set busy timeout FIRST before other pragmas
    database.exec("PRAGMA busy_timeout = 5000;");
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA synchronous = NORMAL;");
    database.exec("PRAGMA cache_size = -64000;");
    database.exec("PRAGMA temp_store = MEMORY;");

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

  batchInsert(
    table: string,
    columns: string[],
    rows: Array<ReadonlyArray<unknown>>,
  ): void {
    if (rows.length === 0) {
      return;
    }
    if (columns.length === 0) {
      throw new Error("batchInsert requires at least one column");
    }

    const placeholders = columns.map(() => "?").join(", ");
    const statement = this.raw.prepare(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    );

    const runBatch = this.raw.transaction(
      (batch: Array<ReadonlyArray<unknown>>) => {
        for (const row of batch) {
          if (row.length !== columns.length) {
            throw new Error(
              `Row length ${row.length} does not match columns length ${columns.length}`,
            );
          }
          statement.run(...row);
        }
      },
    );

    runBatch(rows);
  }
}
