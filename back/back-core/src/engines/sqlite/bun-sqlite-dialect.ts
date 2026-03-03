import { Database as BunDatabase } from "bun:sqlite";
import { SqliteDialect } from "kysely";

class BunStatementAdapter {
  constructor(private stmt: any) {}

  run(parameters: readonly unknown[] = []): unknown {
    return this.stmt.run(...parameters);
  }

  all(parameters: readonly unknown[] = []): unknown[] {
    return this.stmt.all(...parameters);
  }

  iterate(parameters: readonly unknown[] = []): IterableIterator<unknown> {
    return this.stmt.iterate(...parameters);
  }
}

class BunDatabaseAdapter {
  constructor(private db: BunDatabase) {}

  prepare(sql: string): BunStatementAdapter {
    return new BunStatementAdapter(this.db.prepare(sql));
  }

  close(): void {
    this.db.close();
  }
}

export class BunSqliteLocal {
  public readonly db: BunDatabase;
  public readonly dialect: SqliteDialect;

  constructor(path: string) {
    this.db = new BunDatabase(path);
    this.dialect = new SqliteDialect({
      database: new BunDatabaseAdapter(this.db) as any,
    });
  }

  close(): void {
    this.db.close();
  }
}
