import { describe, expect, mock, test } from "bun:test";
import type { LogEvent, LogQueryParams } from "./types";

class FakeLogsStore {
  private items: LogEvent[] = [];

  async insert(events: LogEvent[]): Promise<void> {
    this.items.push(...events);
  }

  async list(params: LogQueryParams) {
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 100;
    let rows = this.items.slice();
    if (params.source) rows = rows.filter((row) => row.source === params.source);
    if (params.level !== undefined) rows = rows.filter((row) => row.level === params.level);
    if (params.code !== undefined) rows = rows.filter((row) => row.code === params.code);
    if (params.from_ts !== undefined) rows = rows.filter((row) => row.ts >= params.from_ts!);
    if (params.to_ts !== undefined) rows = rows.filter((row) => row.ts <= params.to_ts!);
    rows.sort((a, b) => b.ts - a.ts);
    return { items: rows.slice(offset, offset + limit), totalCount: rows.length };
  }

  async getStatistic() {
    const byLevel: Record<number, number> = {};
    const bySource: Record<string, number> = {};
    for (const item of this.items) {
      byLevel[item.level] = (byLevel[item.level] ?? 0) + 1;
      bySource[item.source] = (bySource[item.source] ?? 0) + 1;
    }
    return {
      total: this.items.length,
      byLevel,
      bySource,
      errors: byLevel[3] ?? 0,
      warnings: byLevel[2] ?? 0,
    };
  }

  async moveOldestTo(target: FakeLogsStore, limit = 1000): Promise<number> {
    const batch = this.items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => a.item.ts - b.item.ts)
      .slice(0, limit);
    if (batch.length === 0) return 0;

    await target.insert(batch.map(({ item }) => item));
    const indexes = new Set(batch.map(({ index }) => index));
    this.items = this.items.filter((_item, index) => !indexes.has(index));
    return batch.length;
  }
}

class FakeStoresController {
  public hot = new FakeLogsStore();
  public cold = new FakeLogsStore();

  constructor(_msName: string) {}
  async init(): Promise<void> {}
  async destroy(): Promise<void> {}
}

mock.module("./stores", () => ({
  StoresController: FakeStoresController,
}));

import { LogsServiceImpl } from "./service";

describe("LogsServiceImpl hot/cold storage", () => {
  test("archives hot logs into cold storage", async () => {
    const service = new LogsServiceImpl({
      archiveBatchSize: 1,
    });

    await service.write({
      ts: 10,
      source: "api",
      level: 1,
      code: 100,
      message: "started",
    });
    await service.write({
      ts: 11,
      source: "api",
      level: 3,
      code: 500,
      message: "failed",
    });

    const moved = await service.archiveHotToCold();
    expect(moved).toBe(2);

    const hot = await service.listHot({ offset: 0, limit: 10 });
    const cold = await service.listCold({ offset: 0, limit: 10 });
    const stats = await service.getStatistic();

    expect(hot.totalCount).toBe(0);
    expect(cold.totalCount).toBe(2);
    expect(stats.totalHot).toBe(0);
    expect(stats.totalCold).toBe(2);
    expect(stats.errors).toBe(1);

    await service.destroy();
  });
});
