import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import { ReviewsMetadataStoreService } from "./stores/metadata";
import reviewsMigrations from "./stores/metadata/migrations";

/**
 * A review is published on purpose, so reading it needs no token at all. What
 * the tags decide here is removal: the author's tag, or a moderator's.
 */
describe("who may read and remove a review", () => {
  let store: SqlStore;
  let reviews: ReviewsMetadataStoreService;

  const as = <T>(user: string, fn: () => T, tags?: string[]) =>
    runWithWorkspaceContext({ user, accessTags: tags }, fn);

  beforeEach(async () => {
    store = new SqlStore(
      ":memory:",
      reviewsMigrations,
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();
    reviews = new ReviewsMetadataStoreService(store);
  });

  const write = (actor: string, text = "fast and tidy") =>
    as(actor, () =>
      reviews.create({ author: actor, text, rating: 5 }),
    );

  it("shows reviews to a visitor with no token", async () => {
    const id = await write("alice");

    expect(await reviews.get(id)).toMatchObject({ id });
    const listed = await reviews.list({ offset: 0, limit: 10 });
    expect(listed.items.map((r) => r.id)).toEqual([id]);
    expect(listed.totalCount).toBe(1);
  });

  it("refuses removal by a passer-by who can read it", async () => {
    const id = await write("alice");

    await as("bob", async () => {
      expect(reviews.delete(id)).rejects.toThrow(AccessDeniedError);
    });
    expect(await reviews.get(id)).toMatchObject({ id });
  });

  it("lets the author and a moderator take a review down", async () => {
    const mine = await write("alice");
    const other = await write("carol");
    await reviews.access.grant(other, "moderator");

    expect(await as("alice", () => reviews.delete(mine))).toBe(true);
    expect(await reviews.get(mine)).toBeNull();

    expect(
      await as("dan", () => reviews.delete(other), ["moderator"]),
    ).toBe(true);
    expect(await reviews.list({ offset: 0, limit: 10 })).toMatchObject({
      totalCount: 0,
    });
  });

  it("forgets the tags of a removed review", async () => {
    const id = await write("alice");
    await as("alice", () => reviews.delete(id));

    expect(await reviews.access.tagsOf(id)).toEqual([]);
  });
});
