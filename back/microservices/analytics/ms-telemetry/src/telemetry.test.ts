import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { TelemetryHotStore } from "./stores/hot/service";
import { TelemetryColdStore } from "./stores/cold/service";
import type { TelemetryEventInput } from "./types";

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

describe("Telemetry hot store", () => {
  let tempDir = "";
  let hot: TelemetryHotStore;

  beforeAll(async () => {
    tempDir = await makeTempDir("telemetry-hot-");
    hot = new TelemetryHotStore(join(tempDir, "hot"));
  });

  afterAll(async () => {
    await hot.closeCurrent();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes and lists hot telemetry", async () => {
    const event: TelemetryEventInput = {
      device_id: "printer-1",
      param: "temp",
      value: 220.5,
      unit: "C",
    };

    await hot.write(event);

    const list = await hot.list({
      offset: 0,
      limit: 10,
      device_id: "printer-1",
    });

    expect(list.items.length).toBe(1);
    expect(list.items[0].param).toBe("temp");
  });
});

describe("Telemetry cold store", () => {
  let tempDir = "";
  let cold: TelemetryColdStore;

  beforeAll(async () => {
    tempDir = await makeTempDir("telemetry-cold-");
    cold = new TelemetryColdStore(join(tempDir, "cold", "data.db"));
    await cold.init();
  });

  afterAll(async () => {
    await cold.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("inserts and lists cold telemetry", async () => {
    const now = Date.now();
    await cold.insertBatch([
      {
        ts: now,
        device_id: "cnc-1",
        param: "rpm",
        value: 1200,
        unit: "rpm",
      },
      {
        ts: now + 1,
        device_id: "cnc-1",
        param: "amp",
        value: 3.2,
        unit: "A",
      },
    ]);

    const list = await cold.list({
      offset: 0,
      limit: 10,
      device_id: "cnc-1",
    });

    expect(list.items.length).toBe(2);
    expect(list.items[0].device_id).toBe("cnc-1");
  });
});

describe("Telemetry hot to cold migration", () => {
  let tempDir = "";
  let hot: TelemetryHotStore;
  let cold: TelemetryColdStore;

  beforeAll(async () => {
    tempDir = await makeTempDir("telemetry-migrate-");
    hot = new TelemetryHotStore(join(tempDir, "hot"));
    cold = new TelemetryColdStore(join(tempDir, "cold", "data.db"));
    await cold.init();
  });

  afterAll(async () => {
    await hot.closeCurrent();
    await cold.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("flushes hot telemetry into cold store", async () => {
    await hot.write({
      device_id: "printer-2",
      param: "speed",
      value: 42,
      unit: "mm/s",
    });
    await hot.write({
      device_id: "printer-2",
      param: "flow",
      value: 0.95,
      unit: "ratio",
    });

    const flushed = await hot.flushToCold(cold);
    expect(flushed).toBe(2);

    const coldList = await cold.list({ offset: 0, limit: 10 });
    expect(coldList.items.length).toBe(2);

    const hotList = await hot.list({ offset: 0, limit: 10 });
    expect(hotList.items.length).toBe(0);
  });
});

describe("Telemetry cold to hot migration", () => {
  let tempDir = "";
  let hot: TelemetryHotStore;
  let cold: TelemetryColdStore;

  beforeAll(async () => {
    tempDir = await makeTempDir("telemetry-restore-");
    hot = new TelemetryHotStore(join(tempDir, "hot"));
    cold = new TelemetryColdStore(join(tempDir, "cold", "data.db"));
    await cold.init();
  });

  afterAll(async () => {
    await hot.closeCurrent();
    await cold.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("restores cold telemetry into hot store", async () => {
    const now = Date.now();
    await cold.insertBatch([
      {
        ts: now,
        device_id: "robot-1",
        param: "current",
        value: 12.5,
        unit: "A",
      },
      {
        ts: now + 1,
        device_id: "robot-1",
        param: "voltage",
        value: 48.1,
        unit: "V",
      },
    ]);

    const restored = await hot.restoreFromCold(cold, { device_id: "robot-1" });
    expect(restored).toBe(2);

    const hotList = await hot.list({
      offset: 0,
      limit: 10,
      device_id: "robot-1",
    });
    expect(hotList.items.length).toBe(2);
  });
});
