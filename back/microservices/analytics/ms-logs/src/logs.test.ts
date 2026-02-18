import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { LogsHotStore } from "./stores/hot/service";
import { LogsColdStore } from "./stores/cold/service";
import type { LogEventInput } from "./types";

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

describe("Logs hot store", () => {
  let tempDir = "";
  let hot: LogsHotStore;

  beforeAll(async () => {
    tempDir = await makeTempDir("logs-hot-");
    hot = new LogsHotStore(join(tempDir, "hot"));
  });

  afterAll(async () => {
    await hot.closeCurrent();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes and lists hot logs", async () => {
    const event: LogEventInput = {
      source: "db",
      level: 2,
      code: 100,
      message: "connection lost",
    };

    await hot.write(event);

    const list = await hot.list({
      offset: 0,
      limit: 10,
      source: "db",
    });

    expect(list.items.length).toBe(1);
    expect(list.items[0].message).toBe("connection lost");
  });
});

describe("Logs cold store", () => {
  let tempDir = "";
  let cold: LogsColdStore;

  beforeAll(async () => {
    tempDir = await makeTempDir("logs-cold-");
    cold = new LogsColdStore(join(tempDir, "cold", "data.db"));
    await cold.init();
  });

  afterAll(async () => {
    await cold.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("inserts and lists cold logs", async () => {
    const now = Date.now();
    await cold.insertBatch([
      {
        ts: now,
        source: "printer",
        level: 1,
        code: 200,
        message: "ok",
      },
      {
        ts: now + 1,
        source: "printer",
        level: 3,
        code: 500,
        message: "fault",
      },
    ]);

    const list = await cold.list({
      offset: 0,
      limit: 10,
      source: "printer",
    });

    expect(list.items.length).toBe(2);
    expect(list.items[0].source).toBe("printer");
  });
});

describe("Logs hot to cold migration", () => {
  let tempDir = "";
  let hot: LogsHotStore;
  let cold: LogsColdStore;

  beforeAll(async () => {
    tempDir = await makeTempDir("logs-migrate-");
    hot = new LogsHotStore(join(tempDir, "hot"));
    cold = new LogsColdStore(join(tempDir, "cold", "data.db"));
    await cold.init();
  });

  afterAll(async () => {
    await hot.closeCurrent();
    await cold.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("flushes hot logs into cold store", async () => {
    await hot.write({
      source: "api",
      level: 1,
      code: 101,
      message: "started",
    });
    await hot.write({
      source: "api",
      level: 2,
      code: 102,
      message: "running",
    });

    const flushed = await hot.flushToCold(cold);
    expect(flushed).toBe(2);

    const coldList = await cold.list({ offset: 0, limit: 10 });
    expect(coldList.items.length).toBe(2);

    const hotList = await hot.list({ offset: 0, limit: 10 });
    expect(hotList.items.length).toBe(0);
  });
});

describe("Logs cold to hot migration", () => {
  let tempDir = "";
  let hot: LogsHotStore;
  let cold: LogsColdStore;

  beforeAll(async () => {
    tempDir = await makeTempDir("logs-restore-");
    hot = new LogsHotStore(join(tempDir, "hot"));
    cold = new LogsColdStore(join(tempDir, "cold", "data.db"));
    await cold.init();
  });

  afterAll(async () => {
    await hot.closeCurrent();
    await cold.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("restores cold logs into hot store", async () => {
    const now = Date.now();
    await cold.insertBatch([
      {
        ts: now,
        source: "edge",
        level: 1,
        code: 201,
        message: "up",
      },
      {
        ts: now + 1,
        source: "edge",
        level: 4,
        code: 503,
        message: "down",
      },
    ]);

    const restored = await hot.restoreFromCold(cold, { source: "edge" });
    expect(restored).toBe(2);

    const hotList = await hot.list({ offset: 0, limit: 10, source: "edge" });
    expect(hotList.items.length).toBe(2);
  });
});
