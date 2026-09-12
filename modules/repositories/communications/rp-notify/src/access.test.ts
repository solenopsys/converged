import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import sendsMigrations from "./stores/sends/migrations";
import { NotifySendsStoreService } from "./stores/sends/service";

/**
 * A send record names an addressee and what they were told, so it is private
 * to the two parties. The listing used to be the installation's whole delivery
 * log, available to anyone who could call it.
 */
describe("who sees which sends", () => {
  let store: SqlStore;
  let sends: NotifySendsStoreService;

  const as = <T>(user: string, fn: () => T, tags?: string[]) =>
    runWithWorkspaceContext({ user, accessTags: tags }, fn);

  const asService = <T>(service: string, fn: () => T) =>
    runWithWorkspaceContext({ user: service, actorType: "service" }, fn);

  beforeEach(async () => {
    store = new SqlStore(
      ":memory:",
      sendsMigrations,
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();
    sends = new NotifySendsStoreService(store);
  });

  const send = (by: (fn: () => any) => any, recipient: string) =>
    by(() =>
      sends.recordSend({
        templateId: "order-ready",
        channel: "email",
        recipient,
      } as any),
    );

  it("keeps the delivery log out of a stranger's listing", async () => {
    await send((fn) => as("alice", fn), "bob");

    expect(await as("carol", () => sends.listSends())).toHaveLength(0);
    expect((await as("alice", () => sends.listSends())).length).toBe(1);
  });

  it("shows a service's send to the person it was addressed to", async () => {
    const id = await send((fn) => asService("rp-orders", fn), "bob");

    expect(await as("bob", () => sends.getSend(id))).toMatchObject({ id });
    expect(await as("carol", () => sends.getSend(id))).toBeUndefined();
  });

  it("does not let a person open their record to somebody else's tag", async () => {
    const id = await send((fn) => as("alice", fn), "bob");

    expect(await sends.access.tagsOf(id)).toEqual(["u-alice"]);
    expect(await as("bob", () => sends.getSend(id))).toBeUndefined();
  });

  it("opens the delivery log to support through a group tag", async () => {
    const id = await send((fn) => asService("rp-orders", fn), "bob");
    await sends.access.grant(id, "team-support");

    expect(
      (await as("agent", () => sends.listSends(), ["team-support"])).map(
        (s) => s.id,
      ),
    ).toEqual([id]);
  });

  it("shows nothing to a caller with no token", async () => {
    await send((fn) => asService("rp-orders", fn), "bob");

    expect(await sends.listSends()).toHaveLength(0);
  });
});
