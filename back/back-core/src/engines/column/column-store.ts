import { StorageConnection } from "bun-transport";
import {
  Kysely,
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from "kysely";
import { Store } from "../../stores";
import { Migration, Migrator, MigrationStateStorage } from "../../migrations";
import { createTransportDialect, TransportMigrationStateStorage } from "../transport/transport-driver";
import { BunSqliteLocal } from "../sqlite/bun-sqlite-dialect";

export class ColumnStore<DB = any> implements Store {
  private kysely: Kysely<DB> | null = null;
  private localSqlite: BunSqliteLocal | null = null;
  private mode: "transport" | "local";
  private conn?: StorageConnection;
  private ms?: string;
  private storeName?: string;
  private dataLocation?: string;
  private migrationsState?: MigrationStateStorage;
  private migrations: (new (store: Store) => Migration)[];

  constructor(
    conn: StorageConnection,
    ms: string,
    storeName: string,
    migrations: (new (store: Store) => Migration)[],
  );
  constructor(
    dataLocation: string,
    migrations: (new (store: Store) => Migration)[],
    migrationsState: MigrationStateStorage,
  );
  constructor(
    connOrDataLocation: StorageConnection | string,
    msOrMigrations: string | (new (store: Store) => Migration)[],
    storeOrMigrationsState: string | MigrationStateStorage,
    maybeMigrations?: (new (store: Store) => Migration)[],
  ) {
    if (typeof connOrDataLocation === "string") {
      this.mode = "local";
      this.dataLocation = connOrDataLocation;
      this.migrations = msOrMigrations as (new (store: Store) => Migration)[];
      this.migrationsState = storeOrMigrationsState as MigrationStateStorage;
      return;
    }
    this.mode = "transport";
    this.conn = connOrDataLocation;
    this.ms = msOrMigrations as string;
    this.storeName = storeOrMigrationsState as string;
    this.migrations = maybeMigrations ?? [];
  }

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
    if (this.mode === "transport") {
      return {
        exec: (statement: string) =>
          this.conn!.execSql(this.ms!, this.storeName!, statement),
      };
    }
    if (!this.localSqlite) {
      throw new Error("Database not initialized. Call open() first.");
    }
    return this.localSqlite.db;
  }

  async open(): Promise<void> {
    if (this.kysely) return;
    if (this.mode === "transport") {
      this.conn!.open(this.ms!, this.storeName!, "column");
      this.kysely = new Kysely<DB>({
        dialect: createTransportDialect(this.conn!, this.ms!, this.storeName!),
      });
      return;
    }

    this.localSqlite = new BunSqliteLocal(this.dataLocation!);
    this.kysely = new Kysely<DB>({
      dialect: this.localSqlite.dialect,
    });
  }

  async close(): Promise<void> {
    if (this.kysely) {
      await this.kysely.destroy();
      this.kysely = null;
    }
    if (this.mode === "transport") {
      this.conn!.close_store(this.ms!, this.storeName!);
      return;
    }
    if (this.localSqlite) {
      this.localSqlite.close();
      this.localSqlite = null;
    }
  }

  async migrate(): Promise<void> {
    const stateStorage =
      this.mode === "transport"
        ? new TransportMigrationStateStorage(this.conn!, this.ms!, this.storeName!)
        : this.migrationsState!;
    const migrations = this.migrations.map((M) => new M(this));
    const migrator = new Migrator(migrations, stateStorage);
    await migrator.up();
  }

  batchInsert(
    table: string,
    columns: string[],
    rows: Array<ReadonlyArray<unknown>>,
  ): void {
    if (rows.length === 0) return;
    if (columns.length === 0) {
      throw new Error("batchInsert requires at least one column");
    }

    const escapeVal = (v: unknown): string => {
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "boolean") return v ? "1" : "0";
      if (typeof v === "number" || typeof v === "bigint") return String(v);
      if (v instanceof Uint8Array || v instanceof Buffer)
        return `X'${Buffer.from(v).toString("hex")}'`;
      return `'${String(v).replace(/'/g, "''")}'`;
    };

    const colList = columns.join(", ");
    const stmts = rows.map(
      (row) =>
        `INSERT INTO ${table} (${colList}) VALUES (${row.map(escapeVal).join(", ")})`,
    );
    const sql = `BEGIN;\n${stmts.join(";\n")};\nCOMMIT;`;
    if (this.mode === "transport") {
      this.conn!.execSql(this.ms!, this.storeName!, sql);
      return;
    }
    this.localSqlite!.db.run(sql);
  }
}
