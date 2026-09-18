import {
  applyKyselyFilter,
  generateULID,
  SqlStore,
  sql,
  type KyselyFilterSchema,
} from "back-core";
import type {
  FilterObject,
  UsageEvent,
  UsageEventInput,
  UsageListParams,
  UsageStatsParams,
  UsageDailyStatsItem,
  UsageFunctionStatsItem,
  UsageTotalStats,
  UsageBySolutionItem,
  UsageBySolutionParams,
  UsageSolutionLink,
  PaginatedResult,
} from "../../types";

const usageFilterSchema: KyselyFilterSchema = {
  function: { valueType: "string", operators: ["eq", "in", "contains"], column: "func" },
  user: { valueType: "string", operators: ["eq", "in", "contains"], column: "user" },
  date: { valueType: "date", operators: ["eq", "gt", "gte", "lt", "lte", "between"], column: "date" },
};

export class UsageStoreService {
  constructor(private store: SqlStore) {}

  /** The author is already settled by the service; here it is always present. */
  async recordUsage(events: (UsageEventInput & { user: string })[]): Promise<number> {
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

  async countUsage(filter?: FilterObject): Promise<number> {
    const query = this.applyFilters(
      this.store.db
        .selectFrom("usage_events")
        .select(({ fn }) => fn.countAll().as("count")),
      { filter },
    );
    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
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

  async getUsageByFunction(params: UsageStatsParams = {}): Promise<UsageFunctionStatsItem[]> {
    let query = this.store.db
      .selectFrom("usage_events")
      .select([
        "func",
        sql<number>`count(*)`.as("total"),
      ])
      .groupBy("func")
      .orderBy(sql`count(*)`, "desc");

    query = this.applyFilters(query, params);

    const rows = await query.execute();
    return rows.map((row: any) => ({
      function: row.func,
      total: Number(row.total ?? 0),
    }));
  }

  async linkFunctions(solution: string, functions: string[]): Promise<number> {
    const rows = [...new Set(functions.map((name) => name.trim()).filter(Boolean))].map(
      (func) => ({ solution, func }),
    );
    if (!rows.length) {
      return 0;
    }

    // Linking the same function twice is a repeated instruction, not a
    // conflict: the pair is already the state being asked for.
    await this.store.db
      .insertInto("usage_solutions")
      .values(rows)
      .onConflict((oc) => oc.columns(["solution", "func"]).doNothing())
      .execute();
    return rows.length;
  }

  async unlinkFunction(solution: string, func: string): Promise<boolean> {
    const result = await this.store.db
      .deleteFrom("usage_solutions")
      .where("solution", "=", solution)
      .where("func", "=", func)
      .executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0) > 0;
  }

  async listSolutionFunctions(solution?: string): Promise<UsageSolutionLink[]> {
    let query = this.store.db
      .selectFrom("usage_solutions")
      .select(["solution", "func"])
      .orderBy("solution", "asc")
      .orderBy("func", "asc");

    if (solution) {
      query = query.where("solution", "=", solution);
    }

    const rows = await query.execute();
    return rows.map((row: any) => ({ solution: row.solution, function: row.func }));
  }

  /**
   * Usage grouped by solution, over the period asked for.
   *
   * The join is on the function name, so a solution nobody linked functions to
   * is absent rather than zero — it has not been measured, which is a different
   * statement from "it was not used". A linked solution with no calls in the
   * period does come back with `total: 0`, and that is the one that answers
   * whether it is worth paying for.
   */
  async getUsageBySolution(params: UsageBySolutionParams = {}): Promise<UsageBySolutionItem[]> {
    let query = this.store.db
      .selectFrom("usage_solutions")
      .leftJoin("usage_events", (join) => {
        let on = join.onRef("usage_events.func", "=", "usage_solutions.func");
        if (params.dateFrom) on = on.on("usage_events.date", ">=", params.dateFrom);
        if (params.dateTo) on = on.on("usage_events.date", "<=", params.dateTo);
        return on;
      })
      .select(({ fn }) => [
        "usage_solutions.solution as solution",
        fn.count("usage_events.id").as("total"),
        fn.count("usage_events.user").distinct().as("users"),
        fn.max("usage_events.date").as("lastUsedAt"),
      ])
      .groupBy("usage_solutions.solution")
      .orderBy(sql`count(usage_events.id)`, "desc");

    if (params.solution) {
      query = query.where("usage_solutions.solution", "=", params.solution);
    }

    const rows = await query.execute();
    return rows.map((row: any) => ({
      solution: row.solution,
      total: Number(row.total ?? 0),
      users: Number(row.users ?? 0),
      lastUsedAt: row.lastUsedAt ?? undefined,
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
    return applyKyselyFilter(next, params.filter, usageFilterSchema);
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
