import {
  AccessTags,
  applyKyselyFilter,
  SqlStore,
  generateULID,
  sql,
  type KyselyFilterSchema,
  visibleFrom,
} from "back-core";
import type { CronHistoryEntry, CronHistoryInput, CronHistoryListParams, PaginatedResult } from "../types";

const historyFilterSchema: KyselyFilterSchema = {
  id: { valueType: "string", operators: ["eq", "in"], column: "obj.id" },
  cronId: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"], column: "obj.cronId" },
  cronName: { valueType: "string", operators: ["eq", "in", "contains", "startsWith"], column: "obj.cronName" },
  provider: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"], column: "obj.provider" },
  action: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"], column: "obj.action" },
  success: { valueType: "boolean", operators: ["eq", "notEq"], column: "obj.success" },
  firedAt: { valueType: "date", operators: ["gt", "gte", "lt", "lte", "between"], column: "obj.firedAt" },
};

interface HistoryRow {
  id: string;
  cronId: string;
  cronName: string;
  provider: string;
  action: string;
  firedAt: string;
  success: number;
  message: string | null;
}

function toEntry(row: HistoryRow): CronHistoryEntry {
  return {
    id: row.id,
    cronId: row.cronId,
    cronName: row.cronName,
    provider: row.provider,
    action: row.action,
    firedAt: row.firedAt,
    success: row.success === 1,
    message: row.message ?? undefined,
  };
}

export class HistoryStoreService {
  /**
   * Who may see which run.
   *
   * A run record says which job fired, for whom and whether it failed, which is
   * operations data for the installation: it is written `authenticated` and
   * carries the tag of whoever recorded it. A caller with no token now sees an
   * empty history instead of every scheduled job in the system, and a per-team
   * history is a `team-*` grant away.
   */
  readonly access: AccessTags;

  constructor(private readonly store: SqlStore) {
    this.access = new AccessTags(store);
  }

  async record(entry: CronHistoryInput): Promise<CronHistoryEntry> {
    const record: CronHistoryEntry = {
      ...entry,
      id: generateULID(),
      firedAt: new Date().toISOString(),
    };
    await this.store.db
      .insertInto("history" as any)
      .values({
        id: record.id,
        cronId: record.cronId,
        cronName: record.cronName,
        provider: record.provider,
        action: record.action,
        firedAt: record.firedAt,
        success: record.success ? 1 : 0,
        message: record.message ?? null,
      })
      .execute();
    await this.access.tagNew(record.id, { visibility: "authenticated" });
    return record;
  }

  async list(params: CronHistoryListParams): Promise<PaginatedResult<CronHistoryEntry>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let baseQuery = this.visible();
    if (params.cronId) {
      baseQuery = baseQuery.where("obj.cronId" as any, "=", params.cronId);
    }
    baseQuery = applyKyselyFilter(baseQuery, params.filter, historyFilterSchema);

    const countResult = await baseQuery
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();
    const totalCount = Number((countResult as any)?.count ?? 0);

    if (limit === 0) {
      return { items: [], totalCount };
    }

    const items = await baseQuery
      .selectAll("obj")
      .orderBy("obj.firedAt" as any, "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      items: (items as HistoryRow[]).map(toEntry),
      totalCount,
    };
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    const query = applyKyselyFilter(
      this.visible().select((eb: any) => eb.fn.countAll().as("count")),
      filter,
      historyFilterSchema,
    );
    const result = await query.executeTakeFirst();
    return Number((result as any)?.count ?? 0);
  }

  /** Runs the caller may see, as the base of every listing, count and chart. */
  private visible() {
    return visibleFrom(this.store.db, "history");
  }

  async getDailyRuns(days = 30): Promise<Array<{ date: string; total: number; success: number; failed: number }>> {
    const now = new Date();
    const from = new Date(now.getTime() - ((days - 1) * 24 * 60 * 60 * 1000));
    const fromDate = from.toISOString().slice(0, 10);

    const rows = await this.visible()
      .select([
        sql<string>`date(obj.firedAt)`.as("date"),
        sql<number>`count(*)`.as("total"),
        sql<number>`sum(case when obj.success = 1 then 1 else 0 end)`.as(
          "success",
        ),
        sql<number>`sum(case when obj.success = 0 then 1 else 0 end)`.as(
          "failed",
        ),
      ])
      .where(sql`date(obj.firedAt)`, ">=", fromDate as any)
      .groupBy(sql`date(obj.firedAt)`)
      .orderBy(sql`date(obj.firedAt)`, "asc")
      .execute();

    return rows.map((row: any) => ({
      date: String(row.date),
      total: Number(row.total ?? 0),
      success: Number(row.success ?? 0),
      failed: Number(row.failed ?? 0),
    }));
  }
}
