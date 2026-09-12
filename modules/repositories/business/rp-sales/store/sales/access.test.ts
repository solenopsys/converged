import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import migrations from "./migrations";
import { SalesStoreService } from "./services";

/**
 * The book stays the company's — an authenticated salesperson sees the leads
 * they saw before. What the tags settle is everything around that: nothing is
 * readable without a token, a lead's contacts and correspondence follow the
 * lead, a tag is put on leads by its owner and only onto leads they can see,
 * and an id from outside cannot land on an object that already exists.
 */
describe("who sees which leads, tags and campaigns", () => {
	let store: SqlStore;
	let sales: SalesStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(async () => {
		store = new SqlStore(":memory:", migrations, new InMemoryMigrationState());
		await store.open();
		await store.migrate();
		sales = new SalesStoreService(store);
	});

	const now = () => Math.floor(Date.now() / 1000);

	const lead = (actor: string, id: string, description = "Acme") =>
		as(actor, () =>
			sales.addLead({
				id,
				createdAt: now(),
				description,
				lang: "en",
				type: "cnc",
				catalogId: "",
				disabled: false,
			} as any),
		);

	const contact = (actor: string, id: string, leadId: string, value: string) =>
		as(actor, () =>
			sales.addContact({
				id,
				leadId,
				createdAt: now(),
				contactType: "EMAIL",
				value,
				role: "",
				description: "",
			} as any),
		);

	const tag = (actor: string, id: string, name: string) =>
		as(actor, () =>
			sales.saveTag({
				id,
				name,
				description: "",
				createdAt: now(),
				updatedAt: now(),
			}),
		);

	const campaign = (actor: string, id: string) =>
		as(actor, () =>
			sales.saveOutreach({
				id,
				name: id,
				status: "draft",
				lang: "en",
				description: "",
				templateId: null,
				audience: "{}",
				enrichWorkflow: "",
				enrichParams: "{}",
				sendWorkflow: "",
				sendParams: "{}",
				createdAt: now(),
				updatedAt: now(),
			} as any),
		);

	it("shows the book to any authenticated caller and to no anonymous one", async () => {
		await lead("alice", "lead-1");
		await lead("bob", "lead-2");

		const forCarol = await as("carol", () =>
			sales.listLeadsFiltered({}, { offset: 0, limit: 10 }),
		);
		expect(forCarol.totalCount).toBe(2);

		const anonymous = await sales.listLeadsFiltered(
			{},
			{ offset: 0, limit: 10 },
		);
		expect(anonymous.items).toHaveLength(0);
		expect(anonymous.totalCount).toBe(0);
		expect(await sales.countLeadsFiltered()).toBe(0);
	});

	it("refuses to edit a lead the caller only sees", async () => {
		await lead("alice", "lead-1");

		await as("bob", async () => {
			expect(sales.updateLead("lead-1", { lang: "de" })).rejects.toThrow(
				AccessDeniedError,
			);
			expect(sales.updateLeadCatalogId("lead-1", "catalog-9")).rejects.toThrow(
				AccessDeniedError,
			);
		});
		expect(
			await as("alice", () => sales.updateLead("lead-1", { lang: "de" })),
		).toBe(true);
	});

	it("keeps contacts, touches and the funnel with the lead they belong to", async () => {
		await lead("alice", "lead-1");
		await contact("alice", "c1", "lead-1", "buyer@acme.test");
		await as("alice", () =>
			sales.addTouch({
				id: "t1",
				contactId: "c1",
				createdAt: now(),
				description: "called",
				companyName: "Acme",
				outreachId: null,
			}),
		);
		await sales.access.setVisibility("lead-1", "private");

		expect(await as("bob", () => sales.getContact("c1"))).toBeUndefined();
		expect(
			(await as("bob", () => sales.listTouches({ offset: 0, limit: 10 })))
				.totalCount,
		).toBe(0);
		expect(
			(await as("alice", () => sales.listTouches({ offset: 0, limit: 10 })))
				.totalCount,
		).toBe(1);
		expect(await as("bob", () => sales.getContactTypeStats())).toEqual({});
	});

	it("does not let a search reach a lead the caller cannot see", async () => {
		await lead("alice", "lead-secret", "Secret Industries");
		await contact("alice", "c1", "lead-secret", "ceo@secret.test");
		await sales.access.setVisibility("lead-secret", "private");

		const byQuery = await as("bob", () =>
			sales.listLeadsFiltered({ query: "secret" }, { offset: 0, limit: 10 }),
		);
		expect(byQuery.items).toHaveLength(0);
		const byContact = await as("bob", () =>
			sales.listLeadsFiltered(
				{ contact: "ceo@secret.test" },
				{ offset: 0, limit: 10 },
			),
		);
		expect(byContact.items).toHaveLength(0);
		expect(await as("bob", () => sales.listLeadIdsFiltered())).toEqual([]);
	});

	it("refuses to annotate a lead the caller cannot see", async () => {
		await lead("alice", "lead-1");
		await sales.access.setVisibility("lead-1", "private");

		await as("bob", async () => {
			expect(
				sales.addContact({
					id: "c9",
					leadId: "lead-1",
					createdAt: now(),
					contactType: "EMAIL",
					value: "x@y.z",
					role: "",
					description: "",
				} as any),
			).rejects.toThrow(AccessDeniedError);
		});
	});

	it("labels only leads the caller can see, with a tag that is theirs", async () => {
		await tag("alice", "tag-a", "Tag A");
		await lead("alice", "lead-open");
		await lead("bob", "lead-hidden");
		await sales.access.setVisibility("lead-hidden", "private");

		expect(
			await as("alice", () =>
				sales.addTagLeads("tag-a", ["lead-open", "lead-hidden"]),
			),
		).toBe(1);
		await as("carol", async () => {
			expect(sales.addTagLeads("tag-a", ["lead-open"])).rejects.toThrow(
				AccessDeniedError,
			);
			expect(sales.deleteTag("tag-a")).rejects.toThrow(AccessDeniedError);
		});
		expect(await as("alice", () => sales.countTagLeads("tag-a"))).toBe(1);
	});

	it("gives a campaign's queue the campaign's audience", async () => {
		await campaign("alice", "camp-1");
		await as("alice", () =>
			sales.addOutreachTargets([
				{
					id: "target-1",
					outreachId: "camp-1",
					status: "planned",
					position: 0,
					payload: "{}",
					createdAt: now(),
					updatedAt: now(),
				} as any,
			]),
		);
		await sales.access.setVisibility("camp-1", "private");

		expect(
			(
				await as("bob", () =>
					sales.listOutreachTargets({ offset: 0, limit: 10 }),
				)
			).totalCount,
		).toBe(0);
		await as("bob", async () => {
			expect(sales.claimNextOutreachTarget("camp-1")).rejects.toThrow(
				AccessDeniedError,
			);
			expect(
				sales.updateOutreachTargetStatus({ id: "target-1", status: "sent" }),
			).rejects.toThrow(AccessDeniedError);
		});
		// The owner's claim goes through. What it returns is the environment's
		// business — `returning *` comes back empty under this driver — so what is
		// asserted is that the row moved.
		await as("alice", () => sales.claimNextOutreachTarget("camp-1"));
		expect(
			(
				await as("alice", () =>
					sales.listOutreachTargets({ offset: 0, limit: 10 }),
				)
			).items[0],
		).toMatchObject({ id: "target-1", status: "claimed" });
	});

	it("refuses an outside id that another object already answers for", async () => {
		await campaign("alice", "shared-id");

		await as("bob", async () => {
			expect(
				sales.addLead({
					id: "shared-id",
					createdAt: now(),
					description: "Impostor",
					lang: "en",
					type: "",
					catalogId: "",
					disabled: false,
				} as any),
			).rejects.toThrow("id is already taken: shared-id");
		});
		// The campaign kept its own audience: nobody acquired a tag on it.
		expect(await sales.access.tagsOf("shared-id")).toEqual([
			"u-alice",
			"authenticated",
		]);
	});

	it("opens a desk's book to a team through a group tag", async () => {
		await lead("alice", "lead-1");
		await sales.access.setVisibility("lead-1", "private");
		await sales.access.grant("lead-1", "team-sales");

		expect(
			(
				await as("clerk", () =>
					sales.listLeadsFiltered({}, { offset: 0, limit: 10 }),
				)
			).totalCount,
		).toBe(0);
		expect(
			(
				await as(
					"clerk",
					() => sales.listLeadsFiltered({}, { offset: 0, limit: 10 }),
					["team-sales"],
				)
			).totalCount,
		).toBe(1);
	});
});
