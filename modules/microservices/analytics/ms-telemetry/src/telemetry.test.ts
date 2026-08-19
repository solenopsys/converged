import { describe, expect, mock, test } from "bun:test";
import type { TelemetryEvent, TelemetryQueryParams } from "./types";

class FakeTelemetryStore {
  private items: TelemetryEvent[] = [];

  async insert(events: TelemetryEvent[]): Promise<void> {
    this.items.push(...events);
  }

  async list(params: TelemetryQueryParams) {
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 100;
    let rows = this.items.slice();
    if (params.device_id) rows = rows.filter((row) => row.device_id === params.device_id);
    if (params.param) rows = rows.filter((row) => row.param === params.param);
    if (params.from_ts !== undefined) rows = rows.filter((row) => row.ts >= params.from_ts!);
    if (params.to_ts !== undefined) rows = rows.filter((row) => row.ts <= params.to_ts!);
    rows.sort((a, b) => b.ts - a.ts);
    return { items: rows.slice(offset, offset + limit), totalCount: rows.length };
  }

  async getStatistic() {
    const byDevice: Record<string, number> = {};
    const byParam: Record<string, number> = {};
    for (const item of this.items) {
      byDevice[item.device_id] = (byDevice[item.device_id] ?? 0) + 1;
      byParam[item.param] = (byParam[item.param] ?? 0) + 1;
    }
    return { total: this.items.length, byDevice, byParam };
  }

  async moveOldestTo(target: FakeTelemetryStore, limit = 1000): Promise<number> {
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

  async moveOldestBeyondLimitTo(target: FakeTelemetryStore, keepLatest = 5000, limit = 1000): Promise<number> {
    const excess = Math.max(0, this.items.length - keepLatest);
    if (excess === 0) return 0;
    return this.moveOldestTo(target, Math.min(excess, limit));
  }
}

class FakeStoresController {
  public hot = new FakeTelemetryStore();
  public cold = new FakeTelemetryStore();

  constructor(_msName: string) {}
  async init(): Promise<void> {}
  async destroy(): Promise<void> {}
}

mock.module("./stores", () => ({
  StoresController: FakeStoresController,
}));

import { TelemetryServiceImpl } from "./service";

describe("TelemetryServiceImpl hot/cold storage", () => {
  test("archives hot telemetry into cold storage", async () => {
    const service = new TelemetryServiceImpl({
      archiveBatchSize: 1,
      hotBufferSize: 2,
    });

    await service.write({
      ts: 10,
      device_id: "printer-1",
      param: "temp",
      value: 220,
      unit: "C",
    });
    await service.write({
      ts: 11,
      device_id: "printer-1",
      param: "speed",
      value: 42,
      unit: "mm/s",
    });
    await service.write({
      ts: 12,
      device_id: "printer-1",
      param: "temp",
      value: 230,
      unit: "C",
    });

    const moved = await service.archiveHotToCold();
    expect(moved).toBe(1);

    const hot = await service.listHot({ offset: 0, limit: 10 });
    const cold = await service.listCold({ offset: 0, limit: 10 });
    const stats = await service.getStatistic();

    expect(hot.totalCount).toBe(2);
    expect(cold.totalCount).toBe(1);
    expect(stats.totalHot).toBe(2);
    expect(stats.totalCold).toBe(1);
    expect(stats.byDevice["printer-1"]).toBe(3);

    await service.destroy();
  });
});
