import { StorageConnection } from "bun-transport";
import {
  Kysely,
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from "kysely";
import { Store } from "../../stores";
import { Migration, Migrator } from "../../migrations";
import { createTransportDialect, TransportMigrationStateStorage } from "../transport/transport-driver";

export class VectorStore<DB = any> implements Store {
  private kysely: Kysely<DB> | null = null;

  constructor(
    private conn: StorageConnection,
    private ms: string,
    private storeName: string,
    private migrations: (new (store: Store) => Migration)[],
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

  async open(): Promise<void> {
    if (this.kysely) return;
    this.conn.open(this.ms, this.storeName, "vector");
    this.kysely = new Kysely<DB>({
      dialect: createTransportDialect(this.conn, this.ms, this.storeName),
    });
  }

  async close(): Promise<void> {
    if (this.kysely) {
      await this.kysely.destroy();
      this.kysely = null;
    }
    this.conn.close_store(this.ms, this.storeName);
  }

  async migrate(): Promise<void> {
    const stateStorage = new TransportMigrationStateStorage(
      this.conn,
      this.ms,
      this.storeName,
    );
    const migrations = this.migrations.map((M) => new M(this));
    const migrator = new Migrator(migrations, stateStorage);
    await migrator.up();
  }

  searchByVector(
    table: string,
    vectorColumn: string,
    queryVector: number[],
    limit: number,
  ): Array<{ rowid: number; distance: number }> {
    const vecJson = JSON.stringify(queryVector).replace(/'/g, "''");
    const sql = `SELECT rowid, distance FROM vec_${table} WHERE ${vectorColumn} MATCH '${vecJson}' ORDER BY distance LIMIT ${limit}`;
    const rows = this.conn.querySql(this.ms, this.storeName, sql);
    return rows.map((row) => ({
      rowid: Number(row["rowid"]),
      distance: Number(row["distance"]),
    }));
  }
}
