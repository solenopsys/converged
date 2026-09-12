import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import webhooksMigrations from "./stores/webhooks/migrations";
import { WebhooksStoreService } from "./stores/webhooks/service";

/**
 * An endpoint is an integration with a secret attached, and its delivery log is
 * the bodies and headers that came through it. The console keeps listing what
 * it listed, but only for a caller with a token, and the gateway path — resolve
 * by slug, then log the delivery — stays deliberately outside the narrowing,
 * because an inbound delivery has no actor to narrow by.
 */
describe("who sees which endpoints and deliveries", () => {
  let store: SqlStore;
  let webhooks: WebhooksStoreService;

  const as = <T>(user: string, fn: () => T, tags?: string[]) =>
    runWithWorkspaceContext({ user, accessTags: tags }, fn);

  beforeEach(async () => {
    store = new SqlStore(
      ":memory:",
      webhooksMigrations,
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();
    webhooks = new WebhooksStoreService(store);
  });

  const create = (actor: string, name: string) =>
    as(actor, () =>
      webhooks.createEndpoint({
        name,
        provider: "github",
        params: { secret: "s3cret" },
      } as any),
    );

  const deliver = (endpointId: string) =>
    webhooks.createLog({
      endpointId,
      provider: "github",
      method: "POST",
      path: "/hooks/x",
      status: 200,
    } as any);

  it("lists endpoints to any authenticated caller and to no anonymous one", async () => {
    await create("alice", "Builds");

    expect(
      (await as("bob", () => webhooks.listEndpoints({} as any))).totalCount,
    ).toBe(1);
    expect((await webhooks.listEndpoints({} as any)).totalCount).toBe(0);
    expect(await webhooks.countEndpoints()).toBe(0);
  });

  it("refuses edits from someone who only sees the endpoint", async () => {
    const endpoint = await create("alice", "Builds");

    await as("bob", async () => {
      expect(
        webhooks.updateEndpoint(endpoint.id, { enabled: false }),
      ).rejects.toThrow(AccessDeniedError);
      expect(webhooks.deleteEndpoint(endpoint.id)).rejects.toThrow(
        AccessDeniedError,
      );
    });
    expect(
      await as("alice", () =>
        webhooks.updateEndpoint(endpoint.id, { enabled: false }),
      ),
    ).toMatchObject({ enabled: false });
  });

  it("resolves and logs a delivery without a token, by slug", async () => {
    const endpoint = await create("alice", "Builds");

    const resolved = await webhooks.getEndpointBySlug(endpoint.slug);
    expect(resolved?.id).toBe(endpoint.id);
    expect(await deliver(endpoint.id)).toMatchObject({
      endpointId: endpoint.id,
    });
  });

  it("keeps two endpoints from taking one slug, whoever owns them", async () => {
    const first = await create("alice", "Builds");
    const second = await create("bob", "Builds");

    expect(second.slug).not.toBe(first.slug);
  });

  it("shows deliveries only to those who may see their endpoint", async () => {
    const open = await create("alice", "Builds");
    const narrowed = await create("alice", "Payments");
    await webhooks.access.setVisibility(narrowed.id, "private");
    await webhooks.access.grant(narrowed.id, "team-payments");
    await deliver(open.id);
    await deliver(narrowed.id);

    const forBob = await as("bob", () => webhooks.listLogs({} as any));
    expect(forBob.items.map((log) => log.endpointId)).toEqual([open.id]);
    expect(forBob.totalCount).toBe(1);
    expect(await as("bob", () => webhooks.countLogs())).toBe(1);

    const forTeam = await as("clerk", () => webhooks.listLogs({} as any), [
      "team-payments",
    ]);
    expect(forTeam.totalCount).toBe(2);
  });

  it("does not let a log filter reach a hidden endpoint's deliveries", async () => {
    const narrowed = await create("alice", "Payments");
    await webhooks.access.setVisibility(narrowed.id, "private");
    await deliver(narrowed.id);

    const found = await as("bob", () =>
      webhooks.listLogs({ endpointId: narrowed.id } as any),
    );
    expect(found.items).toHaveLength(0);
    expect(found.totalCount).toBe(0);
    expect(await as("bob", () => webhooks.getEndpoint(narrowed.id))).toBeNull();
  });
});
