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

export class ColumnStore<DB = any> implements Store {
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
    this.conn.open(this.ms, this.storeName, "column");
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
    this.conn.execSql(this.ms, this.storeName, sql);
  }
}
