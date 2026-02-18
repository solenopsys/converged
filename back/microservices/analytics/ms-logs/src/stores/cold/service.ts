import { ColumnStore, InMemoryMigrationState } from "back-core";
import coldMigrations from "./migrations";
import { mkdirSync } from "fs";
import { dirname } from "path";
import type { LogEvent, LogQueryParams, PaginatedResult } from "../../types";

const TABLE_NAME = "log_events";

export class LogsColdStore {
  private store: ColumnStore;

  constructor(private dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.store = new ColumnStore(
      dbPath,
      coldMigrations,
      new InMemoryMigrationState(),
    );
  }

  async init(): Promise<void> {
    await this.store.open();
    await this.store.migrate();
  }

  async close(): Promise<void> {
    await this.store.close();
  }

  async count(): Promise<number> {
    const result = await this.store.db
      .selectFrom(TABLE_NAME)
      .select(({ fn }) => fn.countAll().as("count"))
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async insertBatch(events: LogEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    this.store.batchInsert(
      TABLE_NAME,
      ["ts", "source", "level", "code", "message"],
      events.map((event) => [
        event.ts,
        event.source,
        event.level,
        event.code,
        event.message,
      ]),
    );
  }

  async list(params: LogQueryParams): Promise<PaginatedResult<LogEvent>> {
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom(TABLE_NAME).selectAll();
    query = this.applyFilters(query, params);

    const items = await query
      .orderBy("ts", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom(TABLE_NAME)
      .select(({ fn }) => fn.countAll().as("count"));
    countQuery = this.applyFilters(countQuery, params);

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: items as LogEvent[],
      totalCount,
    };
  }

  private applyFilters(query: any, params: LogQueryParams) {
    let current = query;
    if (params.source) {
      current = current.where("source", "=", params.source);
    }
    if (params.level !== undefined) {
      current = current.where("level", "=", params.level);
    }
    if (params.code !== undefined) {
      current = current.where("code", "=", params.code);
    }
    if (params.from_ts !== undefined) {
      current = current.where("ts", ">=", params.from_ts);
    }
    if (params.to_ts !== undefined) {
      current = current.where("ts", "<=", params.to_ts);
    }
    return current;
  }
}
