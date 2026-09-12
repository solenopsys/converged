import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import classifierMigrations from "./store/migrations";
import { SqlStoreService } from "./store/services";

/**
 * A classifier is reference data: whoever holds a token reads it, because every
 * service that resolves a key needs to. What the tags settle is who may rewrite
 * a branch or a mapping group, and that an untokened caller reads nothing.
 */
describe("who sees and who edits the classifier", () => {
	let store: SqlStore;
	let classifier: SqlStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			classifierMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		classifier = new SqlStoreService(store);
	});

	const node = (
		actor: string,
		id: string,
		name: string,
		parentId: string | null = null,
	) =>
		as(actor, () =>
			classifier.addNode({ id, parentId, name, slug: name.toLowerCase() }),
		);

	const map = (actor: string, id: string, groupId: string, key: string) =>
		as(actor, () =>
			classifier.setMapping({ id, groupId, key, value: "v", priority: 0 }),
		);

	it("shows the tree to any authenticated caller and to no anonymous one", async () => {
		await node("editor", "n1", "Materials");

		expect(await as("alice", () => classifier.listRoots())).toHaveLength(1);
		expect(await classifier.listRoots()).toHaveLength(0);
		expect(
			(await classifier.listNodes({ offset: 0, limit: 10 })).totalCount,
		).toBe(0);
	});

	it("gives a child the tags of its branch", async () => {
		await node("editor", "root", "Materials");
		await classifier.access.setVisibility("root", "private");
		await classifier.access.grant("root", "team-catalog");
		await as(
			"cataloger",
			() =>
				classifier.addNode({
					id: "leaf",
					parentId: "root",
					name: "PLA",
					slug: "pla",
				}),
			["team-catalog"],
		);

		expect((await classifier.access.tagsOf("leaf")).sort()).toEqual(
			(await classifier.access.tagsOf("root")).sort(),
		);
		expect(await as("alice", () => classifier.getNode("leaf"))).toBeUndefined();
		expect(
			await as("cat", () => classifier.getNode("leaf"), ["team-catalog"]),
		).toMatchObject({ id: "leaf" });
	});

	it("refuses to hang a node under a branch the caller cannot see", async () => {
		await node("editor", "root", "Materials");
		await classifier.access.setVisibility("root", "private");

		await as("alice", async () => {
			expect(
				classifier.addNode({
					id: "leaf",
					parentId: "root",
					name: "PLA",
					slug: "pla",
				}),
			).rejects.toThrow(AccessDeniedError);
		});
	});

	it("counts only the children the caller may see", async () => {
		await node("editor", "root", "Materials");
		await node("editor", "open", "PLA", "root");
		await node("editor", "hidden", "Secret", "root");
		await classifier.access.setVisibility("hidden", "private");

		const level = await as("alice", () => classifier.listTreeChildren(null));
		expect(level).toHaveLength(1);
		expect(Number(level[0].childrenCount)).toBe(1);
	});

	it("refuses an overwrite of somebody else's mapping", async () => {
		await map("rp-sales", "m1", "currencies", "usd");

		await as("alice", async () => {
			expect(
				classifier.setMapping({
					id: "m2",
					groupId: "currencies",
					key: "usd",
					value: "stolen",
				}),
			).rejects.toThrow(AccessDeniedError);
			expect(classifier.deleteMapping("currencies", "usd")).rejects.toThrow(
				AccessDeniedError,
			);
		});
		expect(
			(await as("alice", () => classifier.getMapping("currencies", "usd")))
				?.value,
		).toBe("v");
	});

	it("lets the owner and the group rewrite a mapping", async () => {
		await map("rp-sales", "m1", "currencies", "usd");
		await classifier.access.grant("m1", "team-catalog");

		expect(
			await as(
				"cat",
				() =>
					classifier.setMapping({
						id: "unused",
						groupId: "currencies",
						key: "usd",
						value: "1.0",
					}),
				["team-catalog"],
			),
		).toBe("m1");
		expect(
			await as("cat", () => classifier.deleteMapping("currencies", "usd"), [
				"team-catalog",
			]),
		).toBe(true);
		expect(await classifier.access.tagsOf("m1")).toEqual([]);
	});

	it("counts a group only over the mappings the caller may see", async () => {
		await map("rp-sales", "m1", "currencies", "usd");
		await map("rp-sales", "m2", "currencies", "eur");
		await classifier.access.setVisibility("m2", "private");

		const groups = await as("alice", () => classifier.listMappingGroups());
		expect(groups).toEqual([{ groupId: "currencies", count: 1 }]);
	});
});
