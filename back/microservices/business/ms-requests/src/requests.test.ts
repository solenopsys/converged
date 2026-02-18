import { describe, it, expect, beforeAll } from "bun:test";
import { SqlStore, InMemoryMigrationState } from "back-core";
import requestsMigrations from "./stores/requests/migrations";
import { RequestsStoreService } from "./stores/requests/service";
import type { RequestInput } from "./types";

describe("RequestsService in-memory", () => {
  let store: SqlStore;
  let requests: RequestsStoreService;

  beforeAll(async () => {
    store = new SqlStore(
      ":memory:",
      requestsMigrations,
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();

    requests = new RequestsStoreService(store);
  });

  it("creates and reads a request", async () => {
    const input: RequestInput = {
      source: "landing",
      status: "new",
      fields: {
        name: "Alex",
        phone: "+1000000000",
        urgent: true,
      },
      files: {
        "file-1": "spec.pdf",
      },
    };

    const id = await requests.createRequest(input);
    const saved = await requests.getRequest(id);

    expect(saved).toBeDefined();
    expect(saved?.source).toBe("landing");
    expect(saved?.status).toBe("new");
    expect(saved?.fields.name).toBe("Alex");
    expect(saved?.files["file-1"]).toBe("spec.pdf");
  });

  it("lists requests with source filter", async () => {
    await requests.createRequest({
      source: "landing",
      fields: { name: "A" },
      files: {},
    });
    await requests.createRequest({
      source: "widget",
      fields: { name: "B" },
      files: {},
    });

    const list = await requests.listRequests({
      offset: 0,
      limit: 10,
      source: "landing",
    });

    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((item) => item.source === "landing")).toBe(true);
  });

  it("updates status and records processing log", async () => {
    const id = await requests.createRequest({
      source: "widget",
      fields: { name: "Client" },
      files: {},
    });

    await requests.updateStatus(id, "in_progress", "operator-1", "picked up");

    const updated = await requests.getRequest(id);
    expect(updated?.status).toBe("in_progress");

    const log = await requests.listProcessing(id);
    expect(log.length).toBe(1);
    expect(log[0].actor).toBe("operator-1");
    expect(log[0].comment).toBe("picked up");
    expect(log[0].status).toBe("in_progress");
  });
});
