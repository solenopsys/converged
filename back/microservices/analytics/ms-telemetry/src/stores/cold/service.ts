import { ColumnStore, InMemoryMigrationState } from "back-core";
import coldMigrations from "./migrations";
import { mkdirSync } from "fs";
import { dirname } from "path";
import type {
  TelemetryEvent,
  TelemetryQueryParams,
  PaginatedResult,
} from "../../types";

const TABLE_NAME = "telemetry_events";

export class TelemetryColdStore {
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

  async insertBatch(events: TelemetryEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    this.store.batchInsert(
      TABLE_NAME,
      ["ts", "device_id", "param", "value", "unit"],
      events.map((event) => [
        event.ts,
        event.device_id,
        event.param,
        event.value,
        event.unit,
      ]),
    );
  }

  async list(
    params: TelemetryQueryParams,
  ): Promise<PaginatedResult<TelemetryEvent>> {
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
      items: items as TelemetryEvent[],
      totalCount,
    };
  }

  private applyFilters(query: any, params: TelemetryQueryParams) {
    let current = query;
    if (params.device_id) {
      current = current.where("device_id", "=", params.device_id);
    }
    if (params.param) {
      current = current.where("param", "=", params.param);
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
