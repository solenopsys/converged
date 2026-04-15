import { ColumnStore, sql } from "back-core";
import type { LogEvent, LogEventInput, LogQueryParams, LogsStatistic, PaginatedResult } from "../../types";

const TABLE_NAME = "log_events";

export class LogsStoreService {
  constructor(private store: ColumnStore) {}

  async insert(events: LogEvent[]): Promise<void> {
    if (!events.length) return;
    this.store.batchInsert(
      TABLE_NAME,
      ["ts", "source", "level", "code", "message"],
      events.map((e) => [e.ts, e.source, e.level, e.code, e.message]),
    );
  }

  async list(params: LogQueryParams): Promise<PaginatedResult<LogEvent>> {
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom(TABLE_NAME).selectAll();
    query = this.applyFilters(query, params);

    const items = await query.orderBy("ts", "desc").limit(limit).offset(offset).execute();

    let countQuery = this.store.db
      .selectFrom(TABLE_NAME)
      .select(({ fn }) => fn.countAll().as("count"));
    countQuery = this.applyFilters(countQuery, params);

    const countResult = await countQuery.executeTakeFirst();

    return { items: items as LogEvent[], totalCount: Number(countResult?.count ?? 0) };
  }

  async getStatistic(): Promise<LogsStatistic> {
    const [countResult, levelStats, sourceStats] = await Promise.all([
      this.store.db
        .selectFrom(TABLE_NAME)
        .select(({ fn }) => fn.countAll().as("count"))
        .executeTakeFirst(),
      this.store.db
        .selectFrom(TABLE_NAME)
        .select(["level"])
        .select(({ fn }) => fn.countAll().as("count"))
        .groupBy("level")
        .execute(),
      this.store.db
        .selectFrom(TABLE_NAME)
        .select(["source"])
        .select(({ fn }) => fn.countAll().as("count"))
        .groupBy("source")
        .execute(),
    ]);

    const byLevel: Record<number, number> = {};
    for (const row of levelStats) {
      byLevel[row.level as number] = Number(row.count);
    }

    const bySource: Record<string, number> = {};
    for (const row of sourceStats) {
      bySource[row.source as string] = Number(row.count);
    }

    return {
      total: Number(countResult?.count ?? 0),
      byLevel,
      bySource,
      errors: byLevel[3] ?? 0,
      warnings: byLevel[2] ?? 0,
    };
  }

  async moveOldestTo(target: LogsStoreService, limit = 1000): Promise<number> {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1000;
    const rows = await this.store.db
      .selectFrom(TABLE_NAME)
      .selectAll()
      .select(sql<number>`rowid`.as("__rowid"))
      .orderBy("ts", "asc")
      .limit(safeLimit)
      .execute() as Array<LogEvent & { __rowid: number }>;

    if (rows.length === 0) {
      return 0;
    }

    await target.insert(rows.map(({ __rowid: _rowid, ...event }) => event));
    await this.store.db
      .deleteFrom(TABLE_NAME)
      .where("rowid" as any, "in", rows.map((row) => row.__rowid))
      .execute();

    return rows.length;
  }

  private applyFilters(query: any, params: LogQueryParams) {
    let q = query;
    if (params.source) q = q.where("source", "=", params.source);
    if (params.level !== undefined) q = q.where("level", "=", params.level);
    if (params.code !== undefined) q = q.where("code", "=", params.code);
    if (params.from_ts !== undefined) q = q.where("ts", ">=", params.from_ts);
    if (params.to_ts !== undefined) q = q.where("ts", "<=", params.to_ts);
    return q;
  }
}
