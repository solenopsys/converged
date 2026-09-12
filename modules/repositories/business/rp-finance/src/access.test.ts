import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import financeMigrations from "./stores/finance/migrations";
import { FinanceStoreService } from "./stores/finance/service";

/**
 * The ledger stays company-wide, so the figures the finance screens show do
 * not change. What changes is that a caller without a token sees nothing, that
 * corrections belong to the entry's own people, and that every total is taken
 * over the same narrowed set as the list it accompanies.
 */
describe("who sees which transactions", () => {
  let store: SqlStore;
  let finance: FinanceStoreService;

  const as = <T>(user: string, fn: () => T, tags?: string[]) =>
    runWithWorkspaceContext({ user, accessTags: tags }, fn);

  beforeEach(async () => {
    store = new SqlStore(
      ":memory:",
      financeMigrations,
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();
    finance = new FinanceStoreService(store);
  });

  const record = (
    actor: string,
    type: "income" | "expense" = "income",
    amount = 100,
  ) =>
    as(actor, () =>
      finance.addTransaction({ type, category: "sales", amount } as any),
    );

  it("shows the ledger to any authenticated caller", async () => {
    await record("alice");
    await record("bob", "expense");

    const listed = await as("carol", () =>
      finance.listTransactions({ offset: 0, limit: 10 } as any),
    );
    expect(listed.items).toHaveLength(2);
    expect(listed.totalCount).toBe(2);
  });

  it("shows nothing to a caller with no token", async () => {
    await record("alice");

    const listed = await finance.listTransactions({ offset: 0, limit: 10 } as any);
    expect(listed.items).toHaveLength(0);
    expect(listed.totalCount).toBe(0);
    expect(
      (await finance.getPeriodSummary({
        from: "2000-01-01T00:00:00.000Z",
        to: "2100-01-01T00:00:00.000Z",
      } as any)).revenue,
    ).toBe(0);
  });

  it("counts the page's own conditions, not just its type", async () => {
    await record("alice", "income");
    await record("alice", "expense");
    await record("alice", "expense");

    const listed = await as("alice", () =>
      finance.listTransactions({
        offset: 0,
        limit: 10,
        type: "expense",
        isPaid: false,
      } as any),
    );
    expect(listed.items).toHaveLength(2);
    expect(listed.totalCount).toBe(2);
  });

  it("refuses a correction from someone the entry is merely visible to", async () => {
    const mine = await record("alice");

    await as("bob", async () => {
      expect(finance.patchTransaction(mine, { amount: 1 })).rejects.toThrow(
        AccessDeniedError,
      );
      expect(finance.deleteTransaction(mine)).rejects.toThrow(AccessDeniedError);
    });
    expect(await as("alice", () => finance.patchTransaction(mine, { amount: 1 })))
      .toBeUndefined();
  });

  it("lets the finance team correct what it holds a tag for", async () => {
    const entry = await record("alice");
    await finance.access.grant(entry, "team-finance");

    expect(
      await as("clerk", () => finance.deleteTransaction(entry), [
        "team-finance",
      ]),
    ).toBe(true);
    expect(await finance.access.tagsOf(entry)).toEqual([]);
  });

  it("narrows the ledger to a team once the open tag is dropped", async () => {
    const entry = await record("alice");
    await finance.access.setVisibility(entry, "private");
    await finance.access.grant(entry, "team-finance");

    expect(await as("carol", () => finance.getTransaction(entry))).toBeUndefined();
    expect(
      await as("clerk", () => finance.getTransaction(entry), ["team-finance"]),
    ).toMatchObject({ id: entry });
  });
});
