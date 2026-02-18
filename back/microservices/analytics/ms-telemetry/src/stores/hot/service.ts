import { SqlStore, InMemoryMigrationState } from "back-core";
import hotMigrations from "./migrations";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { unlink } from "fs/promises";
import { join } from "path";
import type {
  TelemetryEvent,
  TelemetryEventInput,
  TelemetryQueryParams,
  TelemetryRestoreParams,
  PaginatedResult,
} from "../../types";
import type { TelemetryColdStore } from "../cold/service";

const TABLE_NAME = "telemetry_events";
const DEFAULT_BATCH_SIZE = 1000;

export class TelemetryHotStore {
  private currentDate = "";
  private currentStore: SqlStore | null = null;

  constructor(private baseDir: string) {}

  async write(event: TelemetryEventInput): Promise<void> {
    const store = await this.ensureCurrentStore();
    const ts = event.ts ?? Date.now();

    await store.db
      .insertInto(TABLE_NAME)
      .values({
        ts,
        device_id: event.device_id,
        param: event.param,
        value: event.value,
        unit: event.unit ?? "",
      })
      .execute();
  }

  async list(
    params: TelemetryQueryParams,
  ): Promise<PaginatedResult<TelemetryEvent>> {
    const store = await this.ensureCurrentStore();
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    let query = store.db.selectFrom(TABLE_NAME).selectAll();
    query = this.applyFilters(query, params);

    const items = await query
      .orderBy("ts", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = store.db
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

  async flushToCold(
    cold: TelemetryColdStore,
    date?: string,
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): Promise<number> {
    const dateStr = this.resolveDateString(date);
    const isCurrent = dateStr === this.currentDate;

    if (isCurrent && this.currentStore) {
      await this.currentStore.close();
      this.currentStore = null;
      this.currentDate = "";
    }

    const store = await this.openStoreForDate(dateStr, false);
    if (!store) {
      return 0;
    }

    let offset = 0;
    let total = 0;

    while (true) {
      const rows = await store.db
        .selectFrom(TABLE_NAME)
        .selectAll()
        .orderBy("ts", "asc")
        .limit(batchSize)
        .offset(offset)
        .execute();

      if (rows.length === 0) {
        break;
      }

      await cold.insertBatch(rows as TelemetryEvent[]);
      total += rows.length;
      offset += rows.length;
    }

    await store.close();
    await this.removeDbFiles(this.dbPath(dateStr));

    return total;
  }

  async flushOldToCold(
    cold: TelemetryColdStore,
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): Promise<number> {
    this.ensureDir();
    const today = this.dateString(new Date());
    const files = readdirSync(this.baseDir).filter(
      (f) => f.startsWith("db_") && f.endsWith(".db") && !f.includes("-wal") && !f.includes("-shm")
    );

    let total = 0;
    for (const file of files) {
      const match = file.match(/^db_(\d{4}-\d{2}-\d{2})\.db$/);
      if (!match) continue;
      const dateStr = match[1];
      if (dateStr >= today) continue;

      const flushed = await this.flushToCold(cold, dateStr, batchSize);
      total += flushed;
    }

    return total;
  }

  async restoreFromCold(
    cold: TelemetryColdStore,
    params: TelemetryRestoreParams = {},
  ): Promise<number> {
    const batchSize = params.batchSize ?? DEFAULT_BATCH_SIZE;
    const store = await this.ensureCurrentStore();
    let offset = 0;
    let total = 0;

    while (true) {
      const list = await cold.list({
        offset,
        limit: batchSize,
        device_id: params.device_id,
        param: params.param,
        from_ts: params.from_ts,
        to_ts: params.to_ts,
      });

      if (list.items.length === 0) {
        break;
      }

      const rows = list.items.map((event) => ({
        ts: event.ts,
        device_id: event.device_id,
        param: event.param,
        value: event.value,
        unit: event.unit,
      }));

      await store.db.insertInto(TABLE_NAME).values(rows).execute();

      total += rows.length;
      offset += rows.length;
    }

    return total;
  }

  async closeCurrent(): Promise<void> {
    if (this.currentStore) {
      await this.currentStore.close();
      this.currentStore = null;
      this.currentDate = "";
    }
  }

  private resolveDateString(date?: string): string {
    if (date) {
      return date;
    }
    return this.dateString(new Date());
  }

  private dateString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private dbPath(dateStr: string): string {
    return join(this.baseDir, `db_${dateStr}.db`);
  }

  private ensureDir(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private async openStoreForDate(
    dateStr: string,
    createIfMissing: boolean,
  ): Promise<SqlStore | null> {
    this.ensureDir();
    const path = this.dbPath(dateStr);

    if (!createIfMissing && !existsSync(path)) {
      return null;
    }

    const store = new SqlStore(
      path,
      hotMigrations,
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();

    return store;
  }

  private async ensureCurrentStore(): Promise<SqlStore> {
    const dateStr = this.dateString(new Date());
    if (this.currentStore && this.currentDate === dateStr) {
      return this.currentStore;
    }

    if (this.currentStore) {
      await this.currentStore.close();
    }

    this.currentDate = dateStr;
    this.currentStore = (await this.openStoreForDate(
      dateStr,
      true,
    )) as SqlStore;
    return this.currentStore;
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

  private async removeDbFiles(path: string): Promise<void> {
    const targets = [path, `${path}-wal`, `${path}-shm`];
    for (const target of targets) {
      if (existsSync(target)) {
        await unlink(target);
      }
    }
  }
}
