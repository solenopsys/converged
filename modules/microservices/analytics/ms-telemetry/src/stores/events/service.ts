import {
  applyKyselyFilter,
  ColumnStore,
  sql,
  type KyselyFilterSchema,
} from "back-core";
import type {
  FilterObject,
  PaginatedResult,
  TelemetryEvent,
  TelemetryEventInput,
  TelemetryQueryParams,
  TelemetryStatistic,
} from "../../types";

const TABLE_NAME = "telemetry_events";
const telemetryFilterSchema: KyselyFilterSchema = {
  deviceId: { valueType: "string", operators: ["eq", "in", "contains"], column: "device_id" },
  param: { valueType: "string", operators: ["eq", "in", "contains"], column: "param" },
  value: { valueType: "number", operators: ["eq", "gt", "gte", "lt", "lte", "between"], column: "value" },
  ts: { valueType: "number", operators: ["gt", "gte", "lt", "lte", "between"], column: "ts" },
};

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

  async count(filter?: FilterObject): Promise<number> {
    const query = this.applyFilters(
      this.store.db.selectFrom(TABLE_NAME).select(({ fn }) => fn.countAll().as("count")),
      { offset: 0, limit: 1, filter },
    );
    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
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

	async getTitleStatistic(): Promise<{
		total: number;
		devices: string[];
		parameters: string[];
	}> {
		const [total, devices, parameters] = await Promise.all([
			this.store.db
				.selectFrom(TABLE_NAME)
				.select(sql<number>`count(*)`.as("total"))
				.executeTakeFirst(),
			this.store.db
				.selectFrom(TABLE_NAME)
				.select("device_id")
				.distinct()
				.execute(),
			this.store.db
				.selectFrom(TABLE_NAME)
				.select("param")
				.distinct()
				.execute(),
		]);
		return {
			total: Number(total?.total ?? 0),
			devices: devices.map((row) => row.device_id),
			parameters: parameters.map((row) => row.param),
		};
	}

  async moveOldestTo(target: TelemetryStoreService, limit = 1000): Promise<number> {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1000;
    const rows = await this.store.db
      .selectFrom(TABLE_NAME)
      .selectAll()
      .select(sql<number>`rowid`.as("__rowid"))
      .orderBy("ts", "asc")
      .limit(safeLimit)
      .execute() as Array<TelemetryEvent & { __rowid: number }>;

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

  async moveOldestBeyondLimitTo(target: TelemetryStoreService, keepLatest = 5000, limit = 1000): Promise<number> {
    const safeKeepLatest = Number.isFinite(keepLatest) && keepLatest > 0 ? Math.floor(keepLatest) : 5000;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1000;
    const countResult = await this.store.db
      .selectFrom(TABLE_NAME)
      .select(({ fn }) => fn.countAll().as("count"))
      .executeTakeFirst();
    const total = Number(countResult?.count ?? 0);
    const excess = Math.max(0, total - safeKeepLatest);

    if (excess === 0) {
      return 0;
    }

    return this.moveOldestTo(target, Math.min(excess, safeLimit));
  }

  private applyFilters(query: any, params: TelemetryQueryParams) {
    let q = query;
    if (params.device_id) q = q.where("device_id", "=", params.device_id);
    if (params.param) q = q.where("param", "=", params.param);
    if (params.from_ts !== undefined) q = q.where("ts", ">=", params.from_ts);
    if (params.to_ts !== undefined) q = q.where("ts", "<=", params.to_ts);
    return applyKyselyFilter(q, params.filter, telemetryFilterSchema);
  }
}
