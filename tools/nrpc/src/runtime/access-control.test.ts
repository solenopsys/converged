import { describe, expect, test } from "bun:test";
import {
	AccessMatcher,
	countGrants,
	extractPermissionsFromPayload,
	grantPermission,
	mergeGrantTrees,
	parsePermission,
	resolveAccessForMethod,
	revokePermission,
	toGrantTree,
	toPermissionEntries,
	type GrantTree,
} from "./access-control";

describe("query syntax", () => {
	test("normalizes mode and names exactly once", () => {
		expect(parsePermission(" Files / List ")).toEqual({
			service: "Files",
			method: "List",
			mode: "rwx",
		});
		expect(parsePermission("files/list(wr)")?.mode).toBe("rw");
		expect(parsePermission("files list(r)")).toBeNull();
		expect(parsePermission("files/list(rz)")).toBeNull();
	});

	test("a third segment names the kind the permission is about", () => {
		expect(parsePermission("rp/files/save(w)")).toEqual({
			kind: "rp",
			service: "files",
			method: "save",
			mode: "w",
		});
		expect(parsePermission("wf/file-processing/*(x)")?.mode).toBe("x");
	});
});

describe("grant tree", () => {
	test("names each kind and service once", () => {
		const tree: GrantTree = {
			ap: { resonus: { "session.open": "w", "session.close": "w" } },
			rp: { files: { get: "r", save: "w" } },
		};
		expect(toPermissionEntries(tree)).toEqual([
			{ kind: "ap", service: "resonus", method: "session.open", mode: "w" },
			{ kind: "ap", service: "resonus", method: "session.close", mode: "w" },
			{ kind: "rp", service: "files", method: "get", mode: "r" },
			{ kind: "rp", service: "files", method: "save", mode: "w" },
		]);
		expect(countGrants(tree)).toBe(4);
	});

	test("a bare mode in place of the method map covers every method", () => {
		const matcher = new AccessMatcher({ "*": { "*": "rwx" } });
		expect(matcher.canKind("rp", "anything", "atAll", "rwx")).toBe(true);
		expect(matcher.can("anything", "atAll", "x")).toBe(true);
	});

	test("round trips", () => {
		const tree: GrantTree = { rp: { files: { get: "r", getChunks: "r" } } };
		expect(toGrantTree(toPermissionEntries(tree))).toEqual(tree);
	});

	test("a service granting only the wildcard collapses to a bare mode", () => {
		expect(toGrantTree([{ kind: "*", service: "*", method: "*", mode: "rwx" }]))
			.toEqual({ "*": { "*": "rwx" } });
	});

	test("two grants on one method merge into one mode", () => {
		expect(
			toGrantTree([
				{ kind: "rp", service: "files", method: "save", mode: "r" },
				{ kind: "rp", service: "files", method: "save", mode: "w" },
			]),
		).toEqual({ rp: { files: { save: "rw" } } });
	});

	test("malformed nodes are skipped rather than granting anything", () => {
		const tree = {
			rp: { files: { save: "zz", update: ["w"] } },
			ap: "not-an-object",
		} as unknown as GrantTree;
		expect(toPermissionEntries(tree)).toEqual([]);
	});
});

describe("AccessMatcher", () => {
	test("execute is its own capability, not a step above write", () => {
		const matcher = new AccessMatcher({
			wf: { report: { "*": "x" } },
			rp: { files: { save: "w" } },
		});
		expect(matcher.canKind("wf", "report", "run", "x")).toBe(true);
		expect(matcher.canKind("wf", "report", "run", "w")).toBe(false);
		expect(matcher.canKind("rp", "files", "save", "x")).toBe(false);
	});

	test("a kinded grant does not leak across kinds", () => {
		const matcher = new AccessMatcher({ wf: { report: { "*": "x" } } });
		expect(matcher.canKind("wf", "report", "run", "x")).toBe(true);
		expect(matcher.canKind("rp", "report", "run", "x")).toBe(false);
		expect(matcher.canKind("wf", "other", "run", "x")).toBe(false);
	});

	test("a grant under the wildcard kind answers a kinded question", () => {
		const matcher = new AccessMatcher({ "*": { files: { save: "w" } } });
		expect(matcher.canKind("rp", "files", "save", "w")).toBe(true);
		expect(matcher.can("files", "save", "w")).toBe(true);
	});

	test("requires every requested capability and supports both wildcards", () => {
		const matcher = new AccessMatcher({
			"*": {
				Files: { List: "r" },
				all: { audit: "w" },
				logs: { "*": "r" },
			},
		});
		expect(matcher.can("files", "list", "r")).toBe(true);
		expect(matcher.can("files", "list", "w")).toBe(false);
		expect(matcher.can("any-service", "AUDIT", "w")).toBe(true);
		expect(matcher.can("LOGS", "tail", "r")).toBe(true);
		expect(matcher.can("logs", "tail", "rw")).toBe(false);
	});

	test("matches the generated method default", () => {
		expect(resolveAccessForMethod("getState")).toBe("r");
		expect(resolveAccessForMethod("DESCRIBE")).toBe("r");
		expect(resolveAccessForMethod("reload")).toBe("w");
	});
});

describe("editing a tree one grant at a time", () => {
	test("granting adds a method to the mode group it belongs in", () => {
		const tree = grantPermission(
			{ rp: { files: { get: "r" } } },
			"rp/files/getChunks(r)",
		);
		expect(tree).toEqual({ rp: { files: { get: "r", getChunks: "r" } } });
	});

	test("revoking takes away the modes it names and leaves the rest", () => {
		const tree = revokePermission(
			{ rp: { files: { save: "rw", get: "r" } } },
			"rp/files/save(w)",
		);
		expect(tree).toEqual({ rp: { files: { save: "r", get: "r" } } });
	});

	test("revoking every mode drops the method", () => {
		expect(
			revokePermission({ rp: { files: { get: "r" } } }, "rp/files/get(r)"),
		).toEqual({});
	});

	test("merging presets unions the modes on a shared method", () => {
		expect(
			mergeGrantTrees(
				{ rp: { files: { save: "r" } } },
				{ rp: { files: { save: "w" } }, ap: { resonus: { ping: "w" } } },
			),
		).toEqual({
			rp: { files: { save: "rw" } },
			ap: { resonus: { ping: "w" } },
		});
	});
});

describe("the perm claim", () => {
	test("reads a tree and refuses anything else", () => {
		const tree = { rp: { files: { get: "r" } } };
		expect(extractPermissionsFromPayload({ perm: tree })).toEqual(tree);
		expect(extractPermissionsFromPayload({ perm: ["rp/files/get(r)"] })).toEqual(
			{},
		);
		expect(extractPermissionsFromPayload({})).toEqual({});
	});
});
