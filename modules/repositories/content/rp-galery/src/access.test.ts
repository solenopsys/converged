import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import { migrations } from "./stores/metadata";
import { GaleryStoreService } from "./stores/metadata/galeries.service";
import { GaleryImagesStoreService } from "./stores/metadata/images.service";

describe("who sees which galleries", () => {
	let store: SqlStore;
	let galeries: GaleryStoreService;
	let images: GaleryImagesStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(async () => {
		store = new SqlStore(":memory:", migrations, new InMemoryMigrationState());
		await store.open();
		await store.migrate();
		galeries = new GaleryStoreService(store);
		images = new GaleryImagesStoreService(store);
	});

	const addImage = (galeryId: string, actor: string, title: string) =>
		as(actor, () =>
			images.create(
				{ galeryId, title } as any,
				`/f/${title}`,
				`/t/${title}`,
				actor,
			),
		);

	it("shows a gallery to any logged-in caller by default, and to no anonymous one", async () => {
		const id = await as("alice", () =>
			galeries.create({ name: "trips" } as any, "alice"),
		);

		expect((await as("bob", () => galeries.get(id)))?.id).toBe(id);
		expect(
			await runWithWorkspaceContext({}, () => galeries.get(id)),
		).toBeNull();
	});

	it("keeps a narrowed gallery out of a stranger's list and total", async () => {
		const open = await as("alice", () =>
			galeries.create({ name: "open" } as any, "alice"),
		);
		const closed = await as("alice", () =>
			galeries.create({ name: "closed" } as any, "alice"),
		);
		await galeries.access.setVisibility(closed, "private");

		const forBob = await as("bob", () =>
			galeries.list({ offset: 0, limit: 10 } as any),
		);
		expect(forBob.items.map((g) => g.id)).toEqual([open]);
		expect(forBob.totalCount).toBe(1);

		const forAlice = await as("alice", () =>
			galeries.list({ offset: 0, limit: 10 } as any),
		);
		expect(forAlice.totalCount).toBe(2);
	});

	it("gives an image the audience of its gallery", async () => {
		const closed = await as("alice", () =>
			galeries.create({ name: "closed" } as any, "alice"),
		);
		await galeries.access.setVisibility(closed, "private");
		const image = await addImage(closed, "alice", "beach");

		expect(await as("bob", () => images.get(image.id))).toBeNull();
		expect((await as("alice", () => images.get(image.id)))?.id).toBe(image.id);
	});

	it("refuses to list a closed gallery's images at all", async () => {
		const closed = await as("alice", () =>
			galeries.create({ name: "closed" } as any, "alice"),
		);
		await galeries.access.setVisibility(closed, "private");
		await as("bob", async () => {
			expect(
				images.listByGalery(closed, { offset: 0, limit: 10 } as any),
			).rejects.toThrow(AccessDeniedError);
		});
	});

	it("lets a reader see an open gallery but not delete it", async () => {
		const id = await as("alice", () =>
			galeries.create({ name: "trips" } as any, "alice"),
		);
		expect((await as("bob", () => galeries.get(id)))?.id).toBe(id);
		expect(as("bob", () => galeries.delete(id))).rejects.toThrow(
			AccessDeniedError,
		);
		expect(await as("alice", () => galeries.delete(id))).toBe(true);
		expect(await galeries.access.tagsOf(id)).toEqual([]);
	});

	it("lets a team reach a gallery opened to its tag", async () => {
		const id = await as("alice", () =>
			galeries.create({ name: "trips" } as any, "alice"),
		);
		await galeries.access.setVisibility(id, "private");
		await galeries.access.grant(id, "team-editors");

		const forEditor = await as(
			"editor",
			() => galeries.list({ offset: 0, limit: 10 } as any),
			["team-editors"],
		);
		expect(forEditor.items.map((g) => g.id)).toEqual([id]);
		// A group tag on the object is what makes an editor an editor.
		expect(
			await as("editor", () => galeries.access.canWrite(id), ["team-editors"]),
		).toBe(true);
	});
});
