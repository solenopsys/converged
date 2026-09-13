import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import { ReviewInvitesStoreService } from "./stores/invites";
import { ReviewsMetadataStoreService } from "./stores/metadata";
import reviewsMigrations from "./stores/metadata/migrations";
import {
	DEFAULT_SETTINGS,
	ReviewSettingsStoreService,
} from "./stores/settings";

/**
 * The funnel, from the link the shop sends to the review that comes back.
 *
 * Everything here runs as the shop except where the customer is explicitly
 * anonymous — which is the point of the token door and the reason it is worth
 * testing that it opens for exactly one review.
 */
describe("review invites", () => {
	let store: SqlStore;
	let reviews: ReviewsMetadataStoreService;
	let invites: ReviewInvitesStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	const shop = <T>(fn: () => T) => as("shop", fn, ["moderator"]);

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
		invites = new ReviewInvitesStoreService(store);
	});

	const invite = (orderId = "order-1") =>
		shop(() =>
			invites.create({ orderId, contact: "customer@example.com" }, 30),
		);

	it("mints a link nobody can guess from the one before it", async () => {
		const first = await invite("order-1");
		const second = await invite("order-2");

		expect(first.token).not.toBe(second.token);
		expect(first.token.length).toBeGreaterThanOrEqual(24);
		expect(first.status).toBe("queued");
		expect(first.expiresAt > new Date().toISOString()).toBe(true);
	});

	it("tells a holder of the token what the form needs and nothing else", async () => {
		const created = await invite();

		const view = await anonymous(() => invites.byToken(created.token));
		expect(view).toMatchObject({ orderId: "order-1", usable: true });
		expect(view).not.toHaveProperty("contact");
		expect(view).not.toHaveProperty("token");
	});

	it("answers nothing to a token that was never issued", async () => {
		expect(await anonymous(() => invites.byToken("not-a-token"))).toBeNull();
		expect(await anonymous(() => invites.byToken(""))).toBeNull();
	});

	it("records the open once, and stops calling it sent", async () => {
		const created = await invite();
		await shop(() => invites.patch(created.id, { status: "sent" }));

		const first = await anonymous(() => invites.markOpened(created.token));
		expect(first?.status).toBe("opened");

		const listed = await shop(() => invites.list({ offset: 0, limit: 10 }));
		const openedAt = listed.items[0].openedAt;
		expect(openedAt).toBeDefined();

		await anonymous(() => invites.markOpened(created.token));
		const again = await shop(() => invites.list({ offset: 0, limit: 10 }));
		expect(again.items[0].openedAt).toBe(openedAt as string);
	});

	it("spends a link on one review and refuses the second", async () => {
		const created = await invite();
		const reviewId = await anonymous(() =>
			reviews.create({
				author: "a customer",
				text: "came out well",
				rating: 5,
				orderId: "order-1",
				source: "invite",
			}),
		);

		expect(
			await anonymous(() => invites.consume(created.token, reviewId)),
		).toBe(true);
		expect(
			await anonymous(() => invites.consume(created.token, "another")),
		).toBe(false);

		const view = await anonymous(() => invites.byToken(created.token));
		expect(view).toMatchObject({ status: "answered", usable: false });
	});

	it("chases a link that went quiet, but never one that was opened", async () => {
		const quiet = await invite("order-quiet");
		const read = await invite("order-read");
		const long = new Date(Date.now() - 9 * 86400_000).toISOString();

		for (const entry of [quiet, read]) {
			await shop(() => invites.patch(entry.id, { status: "sent" }));
			await store.db
				.updateTable("review_invites" as never)
				.set({ sentAt: long } as never)
				.where("id" as never, "=", entry.id)
				.execute();
		}
		await anonymous(() => invites.markOpened(read.token));

		const due = await shop(() => invites.toFollowUp(5, 1, 10));
		expect(due.map((entry) => entry.orderId)).toEqual(["order-quiet"]);
	});

	it("stops chasing once the allowance is spent", async () => {
		const created = await invite();
		const long = new Date(Date.now() - 9 * 86400_000).toISOString();
		await shop(() => invites.patch(created.id, { status: "sent" }));
		await store.db
			.updateTable("review_invites" as never)
			.set({ sentAt: long, followupCount: 1 } as never)
			.where("id" as never, "=", created.id)
			.execute();

		expect(await shop(() => invites.toFollowUp(5, 1, 10))).toEqual([]);
	});

	it("counts the funnel as the states a link passed through", async () => {
		const answered = await invite("order-a");
		const opened = await invite("order-b");
		const silent = await invite("order-c");
		await invite("order-d"); // still queued: invited, not yet sent

		for (const entry of [answered, opened, silent]) {
			await shop(() => invites.patch(entry.id, { status: "sent" }));
		}
		await anonymous(() => invites.markOpened(answered.token));
		await anonymous(() => invites.markOpened(opened.token));
		await anonymous(() => invites.consume(answered.token, "review-1"));

		expect(await shop(() => invites.funnel())).toEqual({
			invited: 4,
			sent: 3,
			opened: 2,
			answered: 1,
			expired: 0,
		});
	});

	it("finds the links already sent for a batch of orders", async () => {
		await invite("order-1");
		await invite("order-2");

		const found = await shop(() =>
			invites.list({
				offset: 0,
				limit: 50,
				orderIds: ["order-2", "order-3"],
			}),
		);
		expect(found.items.map((entry) => entry.orderId)).toEqual(["order-2"]);
	});
});

describe("the shop's funnel settings", () => {
	let store: SqlStore;
	let settings: ReviewSettingsStoreService;

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			reviewsMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		settings = new ReviewSettingsStoreService(store);
	});

	it("runs on defaults before anybody opens the settings screen", async () => {
		expect(await settings.get()).toMatchObject({
			positiveThreshold: DEFAULT_SETTINGS.positiveThreshold,
			maxFollowups: 1,
			platforms: [],
		});
	});

	it("keeps the untouched knobs when one is changed", async () => {
		await settings.save({ positiveThreshold: 5 });
		const saved = await settings.save({
			platforms: [{ id: "gmaps", label: "Google", url: "https://g.example" }],
		});

		expect(saved.positiveThreshold).toBe(5);
		expect(saved.platforms).toHaveLength(1);
		expect(saved.followupDelayDays).toBe(DEFAULT_SETTINGS.followupDelayDays);
		expect((await settings.get()).platforms[0].id).toBe("gmaps");
	});
});

describe("the reviews dashboard", () => {
	let store: SqlStore;
	let reviews: ReviewsMetadataStoreService;
	let invites: ReviewInvitesStoreService;

	const shop = <T>(fn: () => T) =>
		runWithWorkspaceContext({ user: "shop", accessTags: ["moderator"] }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			reviewsMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		reviews = new ReviewsMetadataStoreService(store);
		invites = new ReviewInvitesStoreService(store);
	});

	it("averages what the caller can see and counts what is still waiting", async () => {
		await shop(async () => {
			const good = await reviews.create({ author: "a", text: "x", rating: 5 });
			await reviews.create({ author: "b", text: "y", rating: 3 });
			await reviews.setStatus(good, "published");
			await reviews.reply(good, "thank you", "shop");
			await reviews.markExternal(good, "gmaps");

			const invited = await invites.create(
				{ orderId: "order-1", contact: "c@example.com" },
				30,
			);
			await invites.patch(invited.id, { status: "sent" });
			await invites.consume(invited.token, good);

			const dashboard = await reviews.dashboard(await invites.funnel());
			expect(dashboard.total).toBe(2);
			expect(dashboard.averageRating).toBe(4);
			expect(dashboard.pending).toBe(1);
			expect(dashboard.awaitingReply).toBe(1);
			expect(dashboard.externalSharePercent).toBe(100);
			expect(dashboard.funnel.answered).toBe(1);
		});
	});
});
