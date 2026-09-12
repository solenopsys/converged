import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWithWorkspaceContext } from "nrpc";
import { SqlStore } from "../engines/sql/sql-store";
import { InMemoryMigrationState } from "../migrations";
import { AccessTagsMigration } from "./migration";
import { listVisible, visibleCount, visibleFrom } from "./query";
import { AccessDeniedError, AccessTags } from "./service";
import { PUBLIC_TAG } from "./tags";

class CreateTopics extends AccessTagsMigration {
	constructor(store: SqlStore) {
		super(store);
		this.id = "create_topics";
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("topics")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("title", "text", (col) => col.notNull())
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("topics").ifExists().execute();
	}
}

let dir: string;
let store: SqlStore;
let access: AccessTags;

async function addTopic(id: string, title: string, tags: string[]) {
	await store.db.insertInto("topics").values({ id, title }).execute();
	await access.grantMany(id, tags);
}

beforeEach(async () => {
	dir = mkdtempSync(join(tmpdir(), "access-test-"));
	store = new SqlStore(
		join(dir, "data.db"),
		[CreateTopics, AccessTagsMigration],
		new InMemoryMigrationState(),
	);
	await store.open();
	await store.migrate();
	access = new AccessTags(store);
});

afterEach(async () => {
	await store.close();
	rmSync(dir, { recursive: true, force: true });
});

const asAlice = <T>(fn: () => T) =>
	runWithWorkspaceContext({ user: "alice" }, fn);
const asBob = <T>(fn: () => T) =>
	runWithWorkspaceContext({ user: "bob", accessTags: ["team-support"] }, fn);
const anonymous = <T>(fn: () => T) => runWithWorkspaceContext({}, fn);

describe("selecting what an actor may see", () => {
	test("returns only the matching objects, whatever the table holds", async () => {
		await addTopic("t1", "alice's own", ["u-alice"]);
		await addTopic("t2", "support only", ["team-support"]);
		await addTopic("t3", "open to all", [PUBLIC_TAG]);
		await addTopic("t4", "nobody's", ["u-carol"]);

		const alice = await asAlice(() =>
			listVisible<{ id: string }>(store.db, "topics"),
		);
		expect(alice.items.map((row) => row.id).sort()).toEqual(["t1", "t3"]);
		expect(alice.totalCount).toBe(2);

		const bob = await asBob(() =>
			listVisible<{ id: string }>(store.db, "topics"),
		);
		expect(bob.items.map((row) => row.id).sort()).toEqual(["t2", "t3"]);
	});

	test("an anonymous caller sees public objects and nothing else", async () => {
		await addTopic("t1", "open", [PUBLIC_TAG]);
		await addTopic("t2", "closed", ["u-alice"]);

		const page = await anonymous(() =>
			listVisible<{ id: string }>(store.db, "topics"),
		);
		expect(page.items.map((row) => row.id)).toEqual(["t1"]);
	});

	test("an object matched by two of the actor's tags is returned once", async () => {
		await addTopic("t1", "both", ["u-bob", "team-support", PUBLIC_TAG]);

		const page = await asBob(() =>
			listVisible<{ id: string }>(store.db, "topics"),
		);
		expect(page.items.map((row) => row.id)).toEqual(["t1"]);
		expect(page.totalCount).toBe(1);
	});

	test("the count matches the selection, so hidden objects do not leak through it", async () => {
		for (let i = 0; i < 30; i++) await addTopic(`open-${i}`, "x", [PUBLIC_TAG]);
		for (let i = 0; i < 70; i++)
			await addTopic(`hidden-${i}`, "x", ["u-carol"]);

		const page = await asAlice(() =>
			listVisible<{ id: string }>(store.db, "topics", { limit: 10 }),
		);
		expect(page.items).toHaveLength(10);
		expect(page.totalCount).toBe(30);
	});

	test("pagination walks the visible objects without repeating or skipping", async () => {
		for (let i = 0; i < 25; i++) {
			await addTopic(`t-${String(i).padStart(3, "0")}`, "x", ["u-alice"]);
		}
		const seen: string[] = [];
		for (let offset = 0; offset < 25; offset += 10) {
			const page = await asAlice(() =>
				listVisible<{ id: string }>(store.db, "topics", { limit: 10, offset }),
			);
			seen.push(...page.items.map((row) => row.id));
		}
		expect(new Set(seen).size).toBe(25);
	});

	test("callers may narrow the selection with their own conditions", async () => {
		await addTopic("t1", "keep", ["u-alice"]);
		await addTopic("t2", "drop", ["u-alice"]);

		const rows = await asAlice(() =>
			visibleFrom(store.db, "topics")
				.select(["obj.id", "obj.title"])
				.where("obj.title", "=", "keep")
				.execute(),
		);
		expect(rows.map((row: { id: string }) => row.id)).toEqual(["t1"]);
	});
});

describe("granting and revoking", () => {
	test("a grant to one person takes effect at once, without a new token", async () => {
		await addTopic("t1", "private", ["u-carol"]);
		expect(await asAlice(() => access.canRead("t1"))).toBe(false);

		await access.grantToUser("t1", "alice");
		expect(await asAlice(() => access.canRead("t1"))).toBe(true);

		await access.revokeFromUser("t1", "alice");
		expect(await asAlice(() => access.canRead("t1"))).toBe(false);
	});

	test("requireRead throws for an object the actor cannot see", async () => {
		await addTopic("t1", "private", ["u-carol"]);
		await asAlice(async () => {
			expect(access.requireRead("t1")).rejects.toThrow(AccessDeniedError);
		});
	});

	test("repeating a grant is not an error and does not duplicate the row", async () => {
		await addTopic("t1", "x", []);
		await access.grantToUser("t1", "alice");
		await access.grantToUser("t1", "alice");
		expect(await access.tagsOf("t1")).toEqual(["u-alice"]);
	});

	test("a new object carries its owner and chosen visibility", async () => {
		await store.db
			.insertInto("topics")
			.values({ id: "t1", title: "x" })
			.execute();
		await access.tagNew("t1", { owner: "alice", visibility: "public" });

		expect((await access.tagsOf("t1")).sort()).toEqual(["public", "u-alice"]);
		expect(await asBob(() => access.canRead("t1"))).toBe(true);
	});

	test("dropping an object clears its tags, so a reused id inherits nothing", async () => {
		await addTopic("t1", "x", ["u-alice", "team-support"]);
		await access.dropObject("t1");
		expect(await access.tagsOf("t1")).toEqual([]);
		expect(await asAlice(() => access.canRead("t1"))).toBe(false);
	});

	test("setTags replaces the whole set rather than adding to it", async () => {
		await addTopic("t1", "x", ["u-alice"]);
		await access.setTags("t1", ["team-support"]);
		expect(await access.tagsOf("t1")).toEqual(["team-support"]);
	});
});

describe("counting", () => {
	test("counts distinct objects, not tag matches", async () => {
		await addTopic("t1", "x", ["u-bob", "team-support"]);
		await addTopic("t2", "x", ["team-support"]);
		expect(await asBob(() => visibleCount(store.db, "topics"))).toBe(2);
	});
});

describe("the query plan", () => {
	/**
	 * The whole design rests on the selection being driven by the tag index. If
	 * it ever starts from the object table instead, everything still returns the
	 * right rows — it just reads the entire table to do it, and nothing fails
	 * until the table is large in production. So the plan itself is the thing
	 * worth asserting.
	 */
	function planOf(query: { compile(): { sql: string } }): string[] {
		const db = new Database(join(dir, "data.db"), { readonly: true });
		try {
			const rows = db
				.prepare(`EXPLAIN QUERY PLAN ${query.compile().sql}`)
				.all() as { detail: string }[];
			return rows.map((row) => row.detail);
		} finally {
			db.close();
		}
	}

	test("starts from the tag index and never scans the object table", async () => {
		await addTopic("t1", "x", ["u-alice"]);

		const plan = asAlice(() =>
			planOf(
				visibleFrom(store.db, "topics")
					.selectAll("obj")
					.orderBy("obj.id")
					.limit(50),
			),
		);
		const text = plan.join("\n");

		expect(text).toContain("access_tags");
		expect(text).toMatch(/SEARCH obj USING (INDEX|INTEGER PRIMARY KEY)/);
		expect(text).not.toMatch(/SCAN obj\b/);
	});

	test("keeps that plan when the caller adds its own condition", async () => {
		await addTopic("t1", "keep", ["u-alice"]);

		const plan = asAlice(() =>
			planOf(
				visibleFrom(store.db, "topics")
					.selectAll("obj")
					.where("obj.title", "=", "keep")
					.orderBy("obj.id")
					.limit(50),
			),
		);
		expect(plan.join("\n")).not.toMatch(/SCAN obj\b/);
	});
});

describe("visibility as a tag", () => {
	test("narrowing an object drops it from other people's lists at once", async () => {
		await store.db
			.insertInto("topics")
			.values({ id: "t1", title: "x" })
			.execute();
		await access.tagNew("t1", { owner: "alice", visibility: "authenticated" });
		expect(await asBob(() => access.canRead("t1"))).toBe(true);

		await access.setVisibility("t1", "private");
		expect(await asBob(() => access.canRead("t1"))).toBe(false);
		// The owner keeps their own tag: only the well-known ones are re-pointed.
		expect(await asAlice(() => access.canRead("t1"))).toBe(true);
	});

	test("widening leaves group grants in place", async () => {
		await addTopic("t1", "x", ["team-support"]);
		await access.setVisibility("t1", "public");
		expect((await access.tagsOf("t1")).sort()).toEqual([
			"public",
			"team-support",
		]);
	});
});

describe("writing", () => {
	test("being able to see an object is not being able to change it", async () => {
		await addTopic("t1", "x", [PUBLIC_TAG, "u-carol"]);
		expect(await asAlice(() => access.canRead("t1"))).toBe(true);
		expect(await asAlice(() => access.canWrite("t1"))).toBe(false);
		await asAlice(async () => {
			expect(access.requireWrite("t1")).rejects.toThrow(AccessDeniedError);
		});
	});

	test("a group tag the object carries makes it writable — that is moderation", async () => {
		await addTopic("t1", "x", ["team-support"]);
		expect(await asBob(() => access.canWrite("t1"))).toBe(true);
		expect(await asAlice(() => access.canWrite("t1"))).toBe(false);
	});

	test("an anonymous caller writes nothing, public or not", async () => {
		await addTopic("t1", "x", [PUBLIC_TAG]);
		expect(await anonymous(() => access.canWrite("t1"))).toBe(false);
	});
});

describe("the owner of a new object", () => {
	test("defaults to the acting subject rather than to nobody", async () => {
		await store.db
			.insertInto("topics")
			.values({ id: "t1", title: "x" })
			.execute();
		await asAlice(() => access.tagNew("t1"));

		expect(await access.tagsOf("t1")).toEqual(["u-alice"]);
		expect(await asAlice(() => access.canRead("t1"))).toBe(true);
	});

	test("an explicit owner still wins, for a service filing on someone's behalf", async () => {
		await store.db
			.insertInto("topics")
			.values({ id: "t1", title: "x" })
			.execute();
		await asAlice(() => access.tagNew("t1", { owner: "carol" }));

		expect(await access.tagsOf("t1")).toEqual(["u-carol"]);
	});
});
