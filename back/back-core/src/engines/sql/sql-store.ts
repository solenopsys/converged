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

export class SqlStore<DB = any> implements Store {
  private kysely: Kysely<DB> | null = null;
  private localSqlite: BunSqliteLocal | null = null;
  private mode: "transport" | "local";
  private conn?: StorageConnection;
  private ms?: string;
  private storeName?: string;
  private dataLocation?: string;
  private migrationsState?: MigrationStateStorage;

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

  private migrations: (new (store: Store) => Migration)[];

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

  async open(): Promise<void> {
    if (this.kysely) return;
    if (this.mode === "transport") {
      this.conn!.open(this.ms!, this.storeName!, "sql");
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
}
