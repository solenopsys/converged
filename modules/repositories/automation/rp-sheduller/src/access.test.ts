import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import historyMigrations from "./stores/history-migrations";
import { HistoryStoreService } from "./stores/history";

/**
 * Run history is operations data: the installation's staff see it, an untokened
 * caller does not, and every total — including the daily chart — is taken over
 * the same narrowed set as the list beside it.
 */
describe("who sees which runs", () => {
  let store: SqlStore;
  let history: HistoryStoreService;

  const as = <T>(user: string, fn: () => T, tags?: string[]) =>
    runWithWorkspaceContext({ user, accessTags: tags }, fn);

  beforeEach(async () => {
    store = new SqlStore(
      ":memory:",
      historyMigrations,
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();
    history = new HistoryStoreService(store);
  });

  const fire = (actor: string, cronId = "cron-1", success = true) =>
    as(actor, () =>
      history.record({
        cronId,
        cronName: "nightly",
        provider: "http",
        action: "call",
        success,
      } as any),
    );

  it("shows the history to any authenticated caller", async () => {
    await fire("rp-dag");
    await fire("rp-dag", "cron-2", false);

    const listed = await as("alice", () =>
      history.list({ offset: 0, limit: 10 } as any),
    );
    expect(listed.items).toHaveLength(2);
    expect(listed.totalCount).toBe(2);
    expect(await as("alice", () => history.count())).toBe(2);
  });

  it("shows nothing to a caller with no token", async () => {
    await fire("rp-dag");

    const listed = await history.list({ offset: 0, limit: 10 } as any);
    expect(listed.items).toHaveLength(0);
    expect(listed.totalCount).toBe(0);
    expect(await history.count()).toBe(0);
    expect(await history.getDailyRuns(7)).toEqual([]);
  });

  it("keeps a narrowed run to the team it was opened to", async () => {
    const open = await fire("rp-dag");
    const narrowed = await fire("rp-dag", "cron-secret");
    await history.access.setVisibility(narrowed.id, "private");
    await history.access.grant(narrowed.id, "team-ops");

    expect(
      (await as("alice", () => history.list({ offset: 0, limit: 10 } as any)))
        .items.map((entry) => entry.id),
    ).toEqual([open.id]);
    expect(
      (
        await as("ops", () => history.list({ offset: 0, limit: 10 } as any), [
          "team-ops",
        ])
      ).items.map((entry) => entry.id).sort(),
    ).toEqual([open.id, narrowed.id].sort());
  });

  it("charts only the runs the caller may see", async () => {
    await fire("rp-dag");
    const hidden = await fire("rp-dag", "cron-secret");
    await history.access.setVisibility(hidden.id, "private");

    const daily = await as("alice", () => history.getDailyRuns(7));
    expect(daily.reduce((sum, day) => sum + day.total, 0)).toBe(1);
  });

  it("does not let a filter reach a run the caller cannot see", async () => {
    const hidden = await fire("rp-dag", "cron-secret");
    await history.access.setVisibility(hidden.id, "private");

    expect(
      await as("alice", () => history.count({ cronId: { eq: "cron-secret" } })),
    ).toBe(0);
  });
});
