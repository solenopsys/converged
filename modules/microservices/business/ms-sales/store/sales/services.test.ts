import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import migrations from "./migrations";
import { SalesStoreService } from "./services";

describe("SalesStoreService.listLeadsFiltered", () => {
	let store: SqlStore;
	let sales: SalesStoreService;

	const addLead = async (id: string, description: string) => {
		await sales.leadRepo.create({
			id,
			createdAt: Math.floor(Date.now() / 1000),
			description,
			lang: "en",
			type: "cnc",
			catalogId: `catalog-${id}`,
			disabled: false,
		});
	};

	const addContact = async (id: string, leadId: string, value: string) => {
		await sales.contactRepo.create({
			id,
			leadId,
			createdAt: Math.floor(Date.now() / 1000),
			contactType: "email",
			value,
			role: "",
			description: "",
		});
	};

	beforeEach(async () => {
		store = new SqlStore(":memory:", migrations, new InMemoryMigrationState());
		await store.open();
		await store.migrate();
		sales = new SalesStoreService(store);

		await addLead("lead-steel", "Steel Crazy by Design");
		await addLead("lead-rextek", "Rextek CNC");
		await addLead("lead-empty", "No contacts lead");

		await addContact("c1", "lead-steel", "steelcrazy.corey@gmail.com");
		await addContact("c2", "lead-steel", "steelcrazy.com");
		await addContact("c3", "lead-rextek", "info@rextek-cnc.com");
	});

	it("finds leads by exact contact value", async () => {
		const result = await sales.listLeadsFiltered(
			{ contact: "steelcrazy.corey@gmail.com" },
			{ limit: 10, offset: 0 },
		);
		expect(result.items.map((lead) => lead.id)).toEqual(["lead-steel"]);
		expect(result.totalCount).toBe(1);
	});

	it("matches substring case-insensitively", async () => {
		const result = await sales.listLeadsFiltered(
			{ contact: "REXTEK" },
			{ limit: 10, offset: 0 },
		);
		expect(result.items.map((lead) => lead.id)).toEqual(["lead-rextek"]);
	});

	it("does not duplicate a lead with several matching contacts", async () => {
		const result = await sales.listLeadsFiltered(
			{ contact: "steelcrazy" },
			{ limit: 10, offset: 0 },
		);
		expect(result.items.map((lead) => lead.id)).toEqual(["lead-steel"]);
		expect(result.totalCount).toBe(1);
	});

	it("combines contact with tags", async () => {
		await sales.assignLeadTag("lead-steel", "hot");
		await sales.assignLeadTag("lead-rextek", "hot");

		const result = await sales.listLeadsFiltered(
			{ tags: ["hot"], contact: "steelcrazy" },
			{ limit: 10, offset: 0 },
		);
		expect(result.items.map((lead) => lead.id)).toEqual(["lead-steel"]);
	});

	it("falls back to plain listing when filters are empty", async () => {
		const result = await sales.listLeadsFiltered(
			{ contact: "  " },
			{ limit: 10, offset: 0 },
		);
		expect(result.totalCount).toBe(3);
	});

	it("returns nothing when contact matches no one", async () => {
		const result = await sales.listLeadsFiltered(
			{ contact: "nobody@nowhere" },
			{ limit: 10, offset: 0 },
		);
		expect(result.items).toEqual([]);
		expect(result.totalCount).toBe(0);
	});
});
