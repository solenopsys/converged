import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { StoreServiceImpl } from "./service";

describe("StoreService", () => {
  let tempDir = "";
  let cwd = "";
  let service: StoreServiceImpl;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "store-test-"));
    cwd = process.cwd();
    process.chdir(tempDir);

    service = new StoreServiceImpl();
    await service.init();
  });

  afterAll(async () => {
    if (service?.stores) {
      await service.stores.destroy();
    }
    process.chdir(cwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves and reads data, file exists on disk", async () => {
    const data = new TextEncoder().encode("hello-store");
    const hash = await service.save(data, data.length, "none", "tester");

    const exists = await service.exists(hash);
    expect(exists).toBe(true);

    const filePath = join(
      tempDir,
      "data",
      "store-ms",
      "chunks",
      "data",
      hash.slice(0, 3),
      hash,
    );
    expect(existsSync(filePath)).toBe(true);

    const read = await service.get(hash);
    expect(Buffer.from(read).toString()).toBe("hello-store");

    const list = await service.list({ key: "", offset: 0, limit: 10 });
    expect(list.items.includes(hash)).toBe(true);
  });

  it("respects refCount on delete", async () => {
    const data = new TextEncoder().encode("same-data");
    const hash = "deadbeefdeadbeef";

    await service.saveWithHash(hash, data);
    await service.saveWithHash(hash, data);

    await service.delete(hash);
    expect(await service.exists(hash)).toBe(true);

    await service.delete(hash);
    expect(await service.exists(hash)).toBe(false);
  });
});
