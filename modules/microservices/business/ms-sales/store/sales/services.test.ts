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

	it("searches lead identity, description and contacts", async () => {
		const byDescription = await sales.listLeadsFiltered(
			{ query: "crazy by design" },
			{ limit: 10, offset: 0 },
		);
		const byContact = await sales.listLeadsFiltered(
			{ query: "rextek-cnc.com" },
			{ limit: 10, offset: 0 },
		);
		expect(byDescription.items.map((lead) => lead.id)).toEqual(["lead-steel"]);
		expect(byContact.items.map((lead) => lead.id)).toEqual(["lead-rextek"]);
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

	it("returns a compact recent daily aggregate", async () => {
		const today = new Date();
		today.setUTCHours(12, 0, 0, 0);

		for (let offset = 0; offset < 14; offset++) {
			const createdAt = Math.floor(
				(today.getTime() - offset * 24 * 60 * 60 * 1000) / 1000,
			);
			await sales.leadRepo.create({
				id: `summary-lead-${offset}`,
				createdAt,
				description: "Dashboard summary lead",
				lang: "en",
				type: "cnc",
				catalogId: "summary",
				disabled: false,
			});
			await sales.touchRepo.create({
				id: `summary-touch-${offset}`,
				contactId: "c1",
				createdAt,
				description: "Dashboard summary touch",
				companyName: null,
				outreachId: null,
			});
		}

		const [leads, touches, daily] = await Promise.all([
			sales.leadRepo.count(),
			sales.touchRepo.count(),
			sales.getRecentDailyStatistics(),
		]);

		expect(leads).toBe(17);
		expect(touches).toBe(14);
		expect(Object.values(daily)).toHaveLength(12);
		expect(Object.values(daily).at(-1)).toMatchObject({
			leads: 4,
			touches: 1,
		});
	});

	it("keeps tag membership many-to-many and idempotent", async () => {
		const now = Math.floor(Date.now() / 1000);
		await sales.saveTag({
			id: "tag-a",
			name: "Tag A",
			description: "",
			createdAt: now,
			updatedAt: now,
		});
		await sales.saveTag({
			id: "tag-b",
			name: "Tag B",
			description: "",
			createdAt: now,
			updatedAt: now,
		});

		await sales.addTagLeads("tag-a", ["lead-steel", "lead-rextek"]);
		await sales.addTagLeads("tag-a", ["lead-steel"]);
		await sales.addTagLeads("tag-b", ["lead-steel"]);

		const [tagA, tagB] = await Promise.all([
			sales.listTagLeads("tag-a", { offset: 0, limit: 10 }),
			sales.listTagLeads("tag-b", { offset: 0, limit: 10 }),
		]);
		expect(tagA.totalCount).toBe(2);
		expect(new Set(tagA.items.map((lead) => lead.id))).toEqual(
			new Set(["lead-steel", "lead-rextek"]),
		);
		expect(tagB.items.map((lead) => lead.id)).toEqual(["lead-steel"]);

		await sales.removeTagLeads("tag-a", ["lead-steel"]);
		expect(
			(await sales.listTagLeads("tag-a", { offset: 0, limit: 10 })).items.map(
				(lead) => lead.id,
			),
		).toEqual(["lead-rextek"]);
		expect(
			(await sales.listTagLeads("tag-b", { offset: 0, limit: 10 })).items.map(
				(lead) => lead.id,
			),
		).toEqual(["lead-steel"]);
	});

	it("filters leads by tag membership through the shared filter", async () => {
		const now = Math.floor(Date.now() / 1000);
		await sales.saveTag({
			id: "tag-a",
			name: "Tag A",
			description: "",
			createdAt: now,
			updatedAt: now,
		});
		await sales.addTagLeads("tag-a", ["lead-steel"]);

		const tagged = await sales.listLeadsFiltered(
			{ filter: { tag: { eq: "tag-a" } } },
			{ offset: 0, limit: 10 },
		);
		expect(tagged.items.map((lead) => lead.id)).toEqual(["lead-steel"]);
		expect(tagged.totalCount).toBe(1);

		const untagged = await sales.listLeadsFiltered(
			{ filter: { tag: { isNull: true } } },
			{ offset: 0, limit: 10 },
		);
		expect(new Set(untagged.items.map((lead) => lead.id))).toEqual(
			new Set(["lead-rextek", "lead-empty"]),
		);

		expect(
			await sales.countLeadsFiltered({
				description: { contains: "CNC" },
			}),
		).toBe(1);

		expect(
			await sales.listLeadIdsFiltered({ tag: { eq: "tag-a" } }),
		).toEqual(["lead-steel"]);
	});

	it("keeps the legacy tag-name filter working through named tags", async () => {
		await sales.assignLeadTag("lead-rextek", "batch-7");
		const result = await sales.listLeadsFiltered(
			{ tags: ["batch-7"] },
			{ offset: 0, limit: 10 },
		);
		expect(result.items.map((lead) => lead.id)).toEqual(["lead-rextek"]);
	});
});
