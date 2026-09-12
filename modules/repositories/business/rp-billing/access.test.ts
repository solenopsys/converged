import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import { BillingStoreService } from "./store/entries/service";
import billingMigrations from "./store/entries/migrations";

/**
 * A billing entry is one account's own. Before the tags, `owner` was a filter
 * — naming somebody else's account listed it — and now it is a tag, so naming
 * it only narrows what the caller already holds.
 */
describe("who sees which billing entries", () => {
  let store: SqlStore;
  let billing: BillingStoreService;

  const as = <T>(user: string, fn: () => T, tags?: string[]) =>
    runWithWorkspaceContext({ user, accessTags: tags }, fn);

  beforeEach(async () => {
    store = new SqlStore(
      ":memory:",
      billingMigrations,
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();
    billing = new BillingStoreService(store);
  });

  const bill = (owner: string, amount = 10) =>
    as(owner, () =>
      billing.addEntry({ owner, category: "usage", amount } as any),
    );

  it("lists an entry to its owner and to nobody else", async () => {
    const mine = await bill("alice");
    await bill("bob");

    const forAlice = await as("alice", () =>
      billing.listEntries({ offset: 0, limit: 10 } as any),
    );
    expect(forAlice.items.map((e) => e.id)).toEqual([mine]);
    expect(forAlice.totalCount).toBe(1);
  });

  it("does not total another account by naming it", async () => {
    await bill("alice", 10);
    await bill("bob", 40);

    expect(await as("alice", () => billing.total({ owner: "bob" } as any))).toBe(
      0,
    );
    expect(await as("alice", () => billing.total({} as any))).toBe(10);
  });

  it("hides an entry from a stranger who knows its id", async () => {
    const mine = await bill("alice");

    expect(await as("bob", () => billing.getEntry(mine))).toBeUndefined();
    expect(await as("alice", () => billing.getEntry(mine))).toMatchObject({
      id: mine,
    });
  });

  it("opens an account to the team billing it through a group tag", async () => {
    const mine = await bill("alice", 25);
    await billing.access.grant(mine, "team-billing");

    const forClerk = await as(
      "clerk",
      () => billing.listEntries({ offset: 0, limit: 10 } as any),
      ["team-billing"],
    );
    expect(forClerk.items.map((e) => e.id)).toEqual([mine]);
    expect(
      await as("clerk", () => billing.total({} as any), ["team-billing"]),
    ).toBe(25);
  });

  it("shows nothing to a caller with no token", async () => {
    await bill("alice");

    expect(
      (await billing.listEntries({ offset: 0, limit: 10 } as any)).totalCount,
    ).toBe(0);
    expect(await billing.total({} as any)).toBe(0);
  });
});
