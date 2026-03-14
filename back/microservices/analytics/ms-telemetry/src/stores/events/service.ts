import { ColumnStore } from "back-core";
import type { TelemetryEvent, TelemetryEventInput, TelemetryQueryParams, TelemetryStatistic, PaginatedResult } from "../../types";

const TABLE_NAME = "telemetry_events";

export class TelemetryStoreService {
  constructor(private store: ColumnStore) {}

  async insert(events: TelemetryEvent[]): Promise<void> {
    if (!events.length) return;
    this.store.batchInsert(
      TABLE_NAME,
      ["ts", "device_id", "param", "value", "unit"],
      events.map((e) => [e.ts, e.device_id, e.param, e.value, e.unit]),
    );
  }

  async list(params: TelemetryQueryParams): Promise<PaginatedResult<TelemetryEvent>> {
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

    return { items: items as TelemetryEvent[], totalCount: Number(countResult?.count ?? 0) };
  }

  async getStatistic(): Promise<{ total: number; byDevice: Record<string, number>; byParam: Record<string, number> }> {
    const [countResult, deviceStats, paramStats] = await Promise.all([
      this.store.db
        .selectFrom(TABLE_NAME)
        .select(({ fn }) => fn.countAll().as("count"))
        .executeTakeFirst(),
      this.store.db
        .selectFrom(TABLE_NAME)
        .select(["device_id"])
        .select(({ fn }) => fn.countAll().as("count"))
        .groupBy("device_id")
        .execute(),
      this.store.db
        .selectFrom(TABLE_NAME)
        .select(["param"])
        .select(({ fn }) => fn.countAll().as("count"))
        .groupBy("param")
        .execute(),
    ]);

    const byDevice: Record<string, number> = {};
    for (const row of deviceStats) {
      byDevice[row.device_id as string] = Number(row.count);
    }

    const byParam: Record<string, number> = {};
    for (const row of paramStats) {
      byParam[row.param as string] = Number(row.count);
    }

    return { total: Number(countResult?.count ?? 0), byDevice, byParam };
  }

  private applyFilters(query: any, params: TelemetryQueryParams) {
    let q = query;
    if (params.device_id) q = q.where("device_id", "=", params.device_id);
    if (params.param) q = q.where("param", "=", params.param);
    if (params.from_ts !== undefined) q = q.where("ts", ">=", params.from_ts);
    if (params.to_ts !== undefined) q = q.where("ts", "<=", params.to_ts);
    return q;
  }
}
