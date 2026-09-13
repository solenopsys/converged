import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import { ReviewsMetadataStoreService } from "./stores/metadata";
import reviewsMigrations from "./stores/metadata/migrations";

/**
 * A review is written to be read — but it earns that on publication.
 *
 * What the tags decide here is therefore two things, not one: who sees a
 * review before anybody has passed it, and who may pass, answer or remove it.
 */
describe("who may read and who may moderate a review", () => {
	let store: SqlStore;
	let reviews: ReviewsMetadataStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	const anonymous = <T>(fn: () => T) =>
		runWithWorkspaceContext({ user: undefined, accessTags: [] }, fn);

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
		as(actor, () => reviews.create({ author: actor, text, rating: 5 }));

	it("keeps an unmoderated review away from a visitor with no token", async () => {
		const id = await write("alice");

		expect(await anonymous(() => reviews.get(id))).toBeNull();
		expect(
			await anonymous(() => reviews.list({ offset: 0, limit: 10 })),
		).toMatchObject({ totalCount: 0 });
	});

	it("shows a published review to a visitor with no token", async () => {
		const id = await write("alice");
		await as("mod", () => reviews.setStatus(id, "published"), ["moderator"]);

		expect(await anonymous(() => reviews.get(id))).toMatchObject({
			id,
			status: "published",
		});
		const listed = await anonymous(() =>
			reviews.list({ offset: 0, limit: 10 }),
		);
		expect(listed.items.map((r) => r.id)).toEqual([id]);
		expect(listed.totalCount).toBe(1);
	});

	it("takes a published review back off the site when it is rejected", async () => {
		const id = await write("alice");
		await as("mod", () => reviews.setStatus(id, "published"), ["moderator"]);
		await as("mod", () => reviews.setStatus(id, "rejected"), ["moderator"]);

		expect(await anonymous(() => reviews.get(id))).toBeNull();
		// The moderator who rejected it still gets their own result back.
		expect(await as("mod", () => reviews.get(id), ["moderator"])).toMatchObject(
			{ id, status: "rejected" },
		);
	});

	it("refuses moderation to a passer-by who can read it", async () => {
		const id = await write("alice");
		await as("mod", () => reviews.setStatus(id, "published"), ["moderator"]);

		await as("bob", async () => {
			expect(reviews.setStatus(id, "rejected")).rejects.toThrow(
				AccessDeniedError,
			);
			expect(reviews.reply(id, "thanks!")).rejects.toThrow(AccessDeniedError);
			expect(reviews.delete(id)).rejects.toThrow(AccessDeniedError);
		});
		expect(await anonymous(() => reviews.get(id))).toMatchObject({ id });
	});

	it("lets a moderator answer a review nobody at the shop wrote", async () => {
		const id = await anonymous(() =>
			reviews.create({ author: "a customer", text: "late", rating: 2 }),
		);

		const answered = await as(
			"mod",
			() => reviews.reply(id, "Sorry — fixed.", "mod"),
			["moderator"],
		);
		expect(answered).toMatchObject({
			reply: "Sorry — fixed.",
			repliedBy: "mod",
		});
	});

	it("lets the author and a moderator take a review down", async () => {
		const mine = await write("alice");
		const other = await write("carol");

		expect(await as("alice", () => reviews.delete(mine))).toBe(true);
		expect(await as("alice", () => reviews.get(mine))).toBeNull();

		expect(await as("dan", () => reviews.delete(other), ["moderator"])).toBe(
			true,
		);
		expect(
			await as("dan", () => reviews.list({ offset: 0, limit: 10 }), [
				"moderator",
			]),
		).toMatchObject({ totalCount: 0 });
	});

	it("forgets the tags of a removed review", async () => {
		const id = await write("alice");
		await as("alice", () => reviews.delete(id));

		expect(await reviews.access.tagsOf(id)).toEqual([]);
	});
});
