import { SqlStore, generateULID, sql } from "back-core";
import type {
  UsageEvent,
  UsageEventInput,
  UsageListParams,
  UsageStatsParams,
  UsageDailyStatsItem,
  UsageTotalStats,
  PaginatedResult,
} from "../../types";

export class UsageStoreService {
  constructor(private store: SqlStore) {}

  async recordUsage(events: UsageEventInput[]): Promise<number> {
    if (!events?.length) {
      return 0;
    }

    const now = new Date().toISOString();
    const rows = events.map((event) => ({
      id: generateULID(),
      func: event.function,
      user: event.user,
      date: event.date ?? now,
      createdAt: now,
    }));

    await this.store.db.insertInto("usage_events").values(rows).execute();
    return rows.length;
  }

  async listUsage(params: UsageListParams): Promise<PaginatedResult<UsageEvent>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db
      .selectFrom("usage_events")
      .selectAll()
      .orderBy("date", "desc")
      .limit(limit)
      .offset(offset);

    query = this.applyFilters(query, params);

    const items = await query.execute();

    let countQuery = this.store.db
      .selectFrom("usage_events")
      .select(({ fn }) => fn.countAll().as("count"));

    countQuery = this.applyFilters(countQuery, params);

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: items.map((row) => this.mapRow(row as any)),
      totalCount,
    };
  }

  async getUsageTotal(params: UsageStatsParams = {}): Promise<UsageTotalStats> {
    let query = this.store.db
      .selectFrom("usage_events")
      .select(({ fn }) => fn.countAll().as("total"));

    query = this.applyFilters(query, params);

    const result = await query.executeTakeFirst();
    return { total: Number(result?.total ?? 0) };
  }

  async getUsageDaily(params: UsageStatsParams = {}): Promise<UsageDailyStatsItem[]> {
    const dateExpr = sql<string>`substr(date, 1, 10)`;
    let query = this.store.db
      .selectFrom("usage_events")
      .select([
        dateExpr.as("date"),
        sql<number>`count(*)`.as("total"),
      ])
      .groupBy(dateExpr)
      .orderBy(dateExpr, "asc");

    query = this.applyFilters(query, params);

    const rows = await query.execute();
    return rows.map((row: any) => ({
      date: row.date,
      total: Number(row.total ?? 0),
    }));
  }

  private applyFilters(query: any, params: UsageListParams | UsageStatsParams) {
    let next = query;
    if (params.function) {
      next = next.where("func", "=", params.function);
    }
    if (params.user) {
      next = next.where("user", "=", params.user);
    }
    if (params.dateFrom) {
      next = next.where("date", ">=", params.dateFrom);
    }
    if (params.dateTo) {
      next = next.where("date", "<=", params.dateTo);
    }
    return next;
  }

  private mapRow(row: any): UsageEvent {
    return {
      id: row.id,
      function: row.func,
      user: row.user,
      date: row.date,
      createdAt: row.createdAt,
    };
  }
}
