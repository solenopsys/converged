import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { UsageStoreService } from "./src/stores/usage/service";
import usageMigrations from "./src/stores/usage/migrations";

/**
 * What the store owes the question "is this solution used, and by whom".
 *
 * The service decides *whose* call an event records — that is a token
 * question and is covered where the token is. Here the subject is the join:
 * a solution is a set of function names, and everything else follows from it.
 */
describe("usage by solution", () => {
  let store: SqlStore;
  let usage: UsageStoreService;

  beforeEach(async () => {
    store = new SqlStore(":memory:", usageMigrations, new InMemoryMigrationState());
    await store.open();
    await store.migrate();
    usage = new UsageStoreService(store);
  });

  const call = (func: string, user: string, date: string) =>
    usage.recordUsage([{ function: func, user, date }]);

  it("counts calls and distinct users per solution", async () => {
    await usage.linkFunctions("orders", ["order.create", "order.close"]);
    await usage.linkFunctions("calls", ["call.start"]);

    await call("order.create", "alice", "2026-09-01T10:00:00.000Z");
    await call("order.close", "alice", "2026-09-02T10:00:00.000Z");
    await call("order.create", "bob", "2026-09-03T10:00:00.000Z");
    await call("call.start", "bob", "2026-09-03T11:00:00.000Z");

    const rows = await usage.getUsageBySolution();
    const byName = Object.fromEntries(rows.map((row) => [row.solution, row]));

    expect(byName.orders).toMatchObject({ total: 3, users: 2 });
    expect(byName.orders.lastUsedAt).toBe("2026-09-03T10:00:00.000Z");
    expect(byName.calls).toMatchObject({ total: 1, users: 1 });
  });

  it("reports a linked but unused solution as zero, not as missing", async () => {
    await usage.linkFunctions("dormant", ["never.called"]);

    const [row] = await usage.getUsageBySolution();
    expect(row).toMatchObject({ solution: "dormant", total: 0, users: 0 });
    expect(row.lastUsedAt).toBeUndefined();
  });

  it("narrows to the period asked for", async () => {
    await usage.linkFunctions("orders", ["order.create"]);
    await call("order.create", "alice", "2026-08-01T10:00:00.000Z");
    await call("order.create", "alice", "2026-09-05T10:00:00.000Z");

    const [row] = await usage.getUsageBySolution({ dateFrom: "2026-09-01" });
    expect(row).toMatchObject({ solution: "orders", total: 1 });
  });

  it("lets one function belong to several solutions", async () => {
    await usage.linkFunctions("orders", ["order.create"]);
    await usage.linkFunctions("sales", ["order.create"]);
    await call("order.create", "alice", "2026-09-01T10:00:00.000Z");

    const rows = await usage.getUsageBySolution();
    expect(rows.map((row) => row.solution).sort()).toEqual(["orders", "sales"]);
    expect(rows.every((row) => row.total === 1)).toBe(true);
  });

  it("takes linking the same function twice as the same instruction", async () => {
    await usage.linkFunctions("orders", ["order.create"]);
    await usage.linkFunctions("orders", ["order.create", "order.close"]);

    const links = await usage.listSolutionFunctions("orders");
    expect(links.map((link) => link.function)).toEqual(["order.close", "order.create"]);
  });

  it("unlinks one function without touching the rest", async () => {
    await usage.linkFunctions("orders", ["order.create", "order.close"]);

    expect(await usage.unlinkFunction("orders", "order.close")).toBe(true);
    expect(await usage.unlinkFunction("orders", "order.close")).toBe(false);

    const links = await usage.listSolutionFunctions("orders");
    expect(links.map((link) => link.function)).toEqual(["order.create"]);
  });
});
