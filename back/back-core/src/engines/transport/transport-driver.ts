import type { StorageConnection } from "bun-transport";
import type {
  CompiledQuery,
  DatabaseConnection,
  Dialect,
  Driver,
  QueryResult,
} from "kysely";
import {
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from "kysely";
import type { MigrationState, MigrationStateStorage } from "../../migrations";

// ── SQL interpolation ────────────────────────────────────────────────────────

function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "number") return String(val);
  if (typeof val === "bigint") return String(val);
  if (val instanceof Uint8Array || val instanceof Buffer) {
    return `X'${Buffer.from(val).toString("hex")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function interpolate(sql: string, params: readonly unknown[]): string {
  let i = 0;
  return sql.replace(/\?/g, () => escapeValue(params[i++]));
}

// ── Transport Kysely connection ───────────────────────────────────────────────

class TransportConnection implements DatabaseConnection {
  constructor(
    private conn: StorageConnection,
    private ms: string,
    private store: string,
  ) {}

  async executeQuery<O>(compiled: CompiledQuery): Promise<QueryResult<O>> {
    const sql = interpolate(compiled.sql, compiled.parameters);
    const upper = sql.trimStart().toUpperCase();

    // Queries that return rows
    const isQuery =
      upper.startsWith("SELECT") ||
      upper.startsWith("WITH") ||
      upper.includes("RETURNING");

    if (isQuery) {
      const rows = this.conn.querySql(this.ms, this.store, sql);
      return { rows: rows as unknown as O[] };
    }

    const { rowsAffected } = this.conn.execSql(this.ms, this.store, sql);
    return {
      rows: [] as O[],
      numAffectedRows: rowsAffected,
      numChangedRows: rowsAffected,
    };
  }

  async *streamQuery<O>(): AsyncIterableIterator<QueryResult<O>> {
    throw new Error("Streaming is not supported with TransportDriver");
  }
}

// ── Transport Kysely driver ───────────────────────────────────────────────────

class TransportDriver implements Driver {
  private connection: TransportConnection;

  constructor(conn: StorageConnection, ms: string, store: string) {
    this.connection = new TransportConnection(conn, ms, store);
  }

  async init(): Promise<void> {}
  async destroy(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return this.connection;
  }

  async beginTransaction(): Promise<void> {}
  async commitTransaction(): Promise<void> {}
  async rollbackTransaction(): Promise<void> {}
  async releaseConnection(): Promise<void> {}
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createTransportDialect(
  conn: StorageConnection,
  ms: string,
  store: string,
): Dialect {
  return {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new TransportDriver(conn, ms, store),
    createIntrospector: (db) => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  };
}

// ── Migration state via transport ─────────────────────────────────────────────

export class TransportMigrationStateStorage implements MigrationStateStorage {
  private cached: string[] = [];

  constructor(
    private conn: StorageConnection,
    private ms: string,
    private store: string,
  ) {}

  async getState(): Promise<MigrationState> {
    const manifest = this.conn.getManifest(this.ms, this.store);
    this.cached = [...manifest.migrations];
    return { executed: [...manifest.migrations] };
  }

  async saveState(state: MigrationState): Promise<void> {
    for (const migId of state.executed) {
      if (!this.cached.includes(migId)) {
        this.conn.recordMigration(this.ms, this.store, migId);
        this.cached.push(migId);
      }
    }
  }
}
