import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { SupportStoreService } from "./src/stores/support/service";
import supportMigrations from "./src/stores/support/migrations";

describe("support tickets", () => {
	let store: SqlStore;
	let support: SupportStoreService;

	beforeEach(async () => {
		store = new SqlStore(":memory:", supportMigrations, new InMemoryMigrationState());
		await store.open();
		await store.migrate();
		support = new SupportStoreService(store);
	});

	const raise = (type: "bug" | "feature", title: string, author: string) =>
		support.createTicket({ type, title, threadId: `thread-${title}` }, author);

	it("numbers tickets in the order they are raised", async () => {
		const first = await raise("bug", "printer jams", "alice");
		const second = await raise("feature", "dark mode", "bob");

		expect(first.number).toBe(1);
		expect(second.number).toBe(2);
		expect(first.status).toBe("open");
		expect(first.votes).toBe(0);
	});

	it("counts one like per person however many times they click", async () => {
		const ticket = await raise("feature", "dark mode", "bob");

		expect(await support.vote(ticket.id, "alice")).toBe(1);
		expect(await support.vote(ticket.id, "alice")).toBe(1);
		expect(await support.vote(ticket.id, "carol")).toBe(2);
	});

	it("takes a like back, and takes nothing back twice", async () => {
		const ticket = await raise("feature", "dark mode", "bob");
		await support.vote(ticket.id, "alice");

		expect(await support.unvote(ticket.id, "alice")).toBe(0);
		expect(await support.unvote(ticket.id, "alice")).toBe(0);
	});

	it("keeps the count and the likes in step", async () => {
		const ticket = await raise("feature", "dark mode", "bob");
		await support.vote(ticket.id, "alice");
		await support.vote(ticket.id, "carol");
		await support.unvote(ticket.id, "alice");

		const rows = await store.db
			.selectFrom("ticket_votes")
			.select(({ fn }) => fn.countAll().as("count"))
			.where("ticketId", "=", ticket.id)
			.executeTakeFirst();

		expect((await support.getTicket(ticket.id))?.votes).toBe(Number(rows?.count));
	});

	it("orders the feature rating by likes", async () => {
		const quiet = await raise("feature", "quiet one", "bob");
		const loud = await raise("feature", "loud one", "bob");
		await support.vote(loud.id, "alice");
		await support.vote(loud.id, "carol");
		await support.vote(quiet.id, "alice");

		const rated = await support.listTickets({
			offset: 0,
			limit: 10,
			type: "feature",
			sort: "votes",
		});
		expect(rated.items.map((item) => item.title)).toEqual(["loud one", "quiet one"]);
	});

	it("shows a caller only their own when narrowed to them", async () => {
		await raise("bug", "mine", "alice");
		await raise("bug", "theirs", "bob");

		const forAlice = await support.listTickets({ offset: 0, limit: 10, type: "bug" }, "alice");
		expect(forAlice.items.map((item) => item.title)).toEqual(["mine"]);
		expect(forAlice.totalCount).toBe(1);
	});

	it("finds a similar ticket by title — what deduplication asks", async () => {
		await raise("feature", "Dark mode for the console", "bob");
		await raise("feature", "Export to CSV", "bob");

		const found = await support.listTickets({
			offset: 0,
			limit: 10,
			type: "feature",
			query: "dark",
		});
		expect(found.items).toHaveLength(1);
		expect(found.items[0].title).toBe("Dark mode for the console");
	});

	it("moves a ticket to a new status", async () => {
		const ticket = await raise("feature", "dark mode", "bob");

		const planned = await support.setStatus(ticket.id, "planned");
		expect(planned?.status).toBe("planned");
		expect(planned!.updatedAt >= ticket.updatedAt).toBe(true);
	});
});
