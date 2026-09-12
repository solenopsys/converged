import { beforeEach, describe, expect, it } from "bun:test";
import { runWithWorkspaceContext } from "nrpc";
import { KVStore } from "../engines/kv/kv-store";
import { AccessDeniedError } from "./service";
import { KvAccessTags } from "./kv";

/**
 * The storage process, reduced to what a tag index touches: a sorted map with
 * prefix listing. Nothing here needs the transport — what is under test is the
 * two key spaces and the decisions read out of them.
 */
function memoryStore(): KVStore {
	const rows = new Map<string, Buffer>();
	const conn = {
		open: () => {},
		kvPut: (_ms: string, _store: string, key: string, value: Buffer) => {
			rows.set(key, value);
		},
		kvGet: (_ms: string, _store: string, key: string) => rows.get(key) ?? null,
		kvDelete: (_ms: string, _store: string, key: string) => {
			rows.delete(key);
		},
		kvList: (_ms: string, _store: string, prefix: string) =>
			[...rows.keys()].filter((key) => key.startsWith(prefix)).sort(),
	};
	return new KVStore(conn as any, "rp-test", "log", []);
}

describe("access tags in a key-value store", () => {
	let access: KvAccessTags;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(() => {
		access = new KvAccessTags(memoryStore());
	});

	it("writes both directions of one grant", () => {
		access.grant("run-1", "team-ops");

		expect(access.tagsOf("run-1")).toEqual(["team-ops"]);
		expect(access.objectsOf("team-ops")).toEqual(["run-1"]);
	});

	it("gives a new object its owner and its visibility", () => {
		as("alice", () => access.tagNew("run-1", { visibility: "authenticated" }));

		expect(access.tagsOf("run-1").sort()).toEqual(["authenticated", "u-alice"]);
	});

	it("answers reads from the open tags and writes only from the actor's own", () => {
		as("alice", () => access.tagNew("run-1", { visibility: "authenticated" }));

		expect(as("bob", () => access.canRead("run-1"))).toBe(true);
		expect(as("bob", () => access.canWrite("run-1"))).toBe(false);
		expect(as("alice", () => access.canWrite("run-1"))).toBe(true);
		as("bob", () => {
			expect(() => access.requireWrite("run-1")).toThrow(AccessDeniedError);
		});
	});

	it("enumerates from the tag side, deduplicated across tags", () => {
		as("alice", () => access.tagNew("run-1", { visibility: "authenticated" }));
		as("alice", () => access.tagNew("run-2", { visibility: "private" }));
		as("bob", () => access.tagNew("run-3", { visibility: "private" }));

		expect([...as("alice", () => access.visibleIds())].sort()).toEqual([
			"run-1",
			"run-2",
		]);
		expect([...as("carol", () => access.visibleIds())]).toEqual(["run-1"]);
	});

	it("narrows an object without disturbing its other tags", () => {
		as("alice", () => access.tagNew("run-1", { visibility: "authenticated" }));
		access.grant("run-1", "team-ops");

		access.setVisibility("run-1", "private");

		expect(access.tagsOf("run-1").sort()).toEqual(["team-ops", "u-alice"]);
		expect(as("carol", () => access.canRead("run-1"))).toBe(false);
		expect(as("ops", () => access.canRead("run-1"), ["team-ops"])).toBe(true);
	});

	it("forgets an object in both directions when it is dropped", () => {
		as("alice", () => access.tagNew("run-1", { visibility: "authenticated" }));

		access.dropObject("run-1");

		expect(access.tagsOf("run-1")).toEqual([]);
		expect(access.objectsOf("authenticated")).toEqual([]);
		expect(as("alice", () => access.canRead("run-1"))).toBe(false);
	});

	it("refuses an id or a tag that would break the key", () => {
		expect(() => access.grant("run:1", "team-ops")).toThrow("must not contain");
		expect(() => access.grant("run-1", "team;ops")).toThrow("must not contain");
	});

	it("does not let one tag's range spill into another's", () => {
		access.grant("run-1", "team");
		access.grant("run-2", "team-ops");

		expect(access.objectsOf("team")).toEqual(["run-1"]);
		expect(access.objectsOf("team-ops")).toEqual(["run-2"]);
	});
});
