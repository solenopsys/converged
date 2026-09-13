import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import usersMigrations from "./stores/users/migrations";
import { UsersStoreService } from "./stores/users/service";

/**
 * An invitation answers one question for the sign-in gate: may this address in,
 * and as what. So the tests are about that question — not about CRUD.
 */
describe("invitations", () => {
  let store: SqlStore;
  let users: UsersStoreService;

  beforeEach(async () => {
    store = new SqlStore(
      ":memory:",
      usersMigrations,
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();
    users = new UsersStoreService(store);
  });

  const invite = (email: string, preset = "operator") =>
    users.createInvite({ email, preset, invitedBy: "owner" });

  it("answers the gate for a live address and nobody else", async () => {
    await invite("Anna@Shop.test");

    expect(await users.getInviteByEmail("anna@shop.test")).toMatchObject({
      preset: "operator",
      status: "pending",
    });
    expect(await users.getInviteByEmail("boris@shop.test")).toBeNull();
  });

  it("matches an address however it was typed", async () => {
    await invite("  Anna@Shop.test ");
    expect(await users.getInviteByEmail("ANNA@shop.test")).not.toBeNull();
  });

  it("keeps one row per address, with the role last chosen", async () => {
    const first = await invite("anna@shop.test", "viewer");
    const second = await invite("anna@shop.test", "manager");

    expect(second.id).toBe(first.id);
    expect(second.preset).toBe("manager");
    expect((await users.listInvites()).totalCount).toBe(1);
  });

  it("treats a lapsed invitation as closed, without a sweep", async () => {
    await users.createInvite({
      email: "late@shop.test",
      preset: "operator",
      invitedBy: "owner",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    expect(await users.getInviteByEmail("late@shop.test")).toBeNull();
    const [stored] = (await users.listInvites()).items;
    expect(stored.status).toBe("expired");
  });

  it("closes on the first sign-in and does not open a second time", async () => {
    await invite("anna@shop.test");

    const consumed = await users.consumeInvite("anna@shop.test");
    expect(consumed?.status).toBe("accepted");
    expect(consumed?.acceptedAt).toBeTruthy();
    expect(await users.consumeInvite("anna@shop.test")).toBeNull();
    expect(await users.getInviteByEmail("anna@shop.test")).toBeNull();
  });

  it("shuts an address out the moment it is revoked", async () => {
    const created = await invite("anna@shop.test");
    await users.revokeInvite(created.id);
    expect(await users.getInviteByEmail("anna@shop.test")).toBeNull();
  });

  it("records delivery without letting the address in twice", async () => {
    const created = await invite("anna@shop.test");
    const sent = await users.markInviteSent(created.id);

    expect(sent?.status).toBe("sent");
    expect(sent?.sentAt).toBeTruthy();
    expect(await users.getInviteByEmail("anna@shop.test")).toMatchObject({
      status: "sent",
    });
  });

  it("carries the group tags the import asked for", async () => {
    const created = await users.createInvite({
      email: "anna@shop.test",
      preset: "manager",
      tags: ["team-ops", "team-hr"],
      invitedBy: "owner",
    });
    expect(created.tags).toEqual(["team-ops", "team-hr"]);
    expect((await users.getInvite(created.id))?.tags).toEqual([
      "team-ops",
      "team-hr",
    ]);
  });

  it("filters the list by status, which is what the projection shows", async () => {
    await invite("a@shop.test");
    const second = await invite("b@shop.test");
    await users.markInviteSent(second.id);

    expect((await users.listInvites({ status: "sent" })).totalCount).toBe(1);
    expect((await users.listInvites({ status: "pending" })).totalCount).toBe(1);
  });

  it("keeps a user's language on the row", async () => {
    const user = await users.createUser({
      id: "u1",
      email: "Anna@Shop.test",
      name: "Anna",
      lang: "ru",
    });
    expect(user.lang).toBe("ru");
    expect((await users.getUserByEmail("anna@shop.test"))?.lang).toBe("ru");
  });
});
