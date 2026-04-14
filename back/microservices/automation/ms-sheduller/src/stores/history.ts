import { SqlStore, generateULID, sql } from "back-core";
import type { CronHistoryEntry, CronHistoryInput, CronHistoryListParams, PaginatedResult } from "../types";

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
  private ensureSchemaPromise?: Promise<void>;

  constructor(private readonly store: SqlStore) {}

  private async ensureSchema(): Promise<void> {
    if (!this.ensureSchemaPromise) {
      this.ensureSchemaPromise = this.store.db.schema
        .createTable("history")
        .ifNotExists()
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("cronId", "text", (col) => col.notNull())
        .addColumn("cronName", "text", (col) => col.notNull())
        .addColumn("provider", "text", (col) => col.notNull())
        .addColumn("action", "text", (col) => col.notNull())
        .addColumn("firedAt", "text", (col) => col.notNull())
        .addColumn("success", "integer", (col) => col.notNull())
        .addColumn("message", "text")
        .execute()
        .then(() => undefined);
    }
    await this.ensureSchemaPromise;
  }

  async record(entry: CronHistoryInput): Promise<CronHistoryEntry> {
    await this.ensureSchema();

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
    return record;
  }

  async list(params: CronHistoryListParams): Promise<PaginatedResult<CronHistoryEntry>> {
    await this.ensureSchema();

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let baseQuery = this.store.db.selectFrom("history" as any);
    if (params.cronId) {
      baseQuery = baseQuery.where("cronId" as any, "=", params.cronId);
    }

    const countResult = await baseQuery
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();
    const totalCount = Number((countResult as any)?.count ?? 0);

    if (limit === 0) {
      return { items: [], totalCount };
    }

    const items = await baseQuery
      .selectAll()
      .orderBy("firedAt" as any, "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      items: (items as HistoryRow[]).map(toEntry),
      totalCount,
    };
  }

  async getDailyRuns(days = 30): Promise<Array<{ date: string; total: number; success: number; failed: number }>> {
    await this.ensureSchema();

    const now = new Date();
    const from = new Date(now.getTime() - ((days - 1) * 24 * 60 * 60 * 1000));
    const fromDate = from.toISOString().slice(0, 10);

    const rows = await this.store.db
      .selectFrom("history" as any)
      .select([
        sql<string>`date(firedAt)`.as("date"),
        sql<number>`count(*)`.as("total"),
        sql<number>`sum(case when success = 1 then 1 else 0 end)`.as("success"),
        sql<number>`sum(case when success = 0 then 1 else 0 end)`.as("failed"),
      ])
      .where(sql`date(firedAt)`, ">=", fromDate as any)
      .groupBy(sql`date(firedAt)`)
      .orderBy(sql`date(firedAt)`, "asc")
      .execute();

    return rows.map((row: any) => ({
      date: String(row.date),
      total: Number(row.total ?? 0),
      success: Number(row.success ?? 0),
      failed: Number(row.failed ?? 0),
    }));
  }
}
