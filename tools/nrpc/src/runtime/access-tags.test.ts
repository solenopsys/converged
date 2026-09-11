import { describe, expect, test } from "bun:test";
import type { GrantTree } from "./access-control";
import {
	getCurrentAccessTags,
	personalTag,
	tagsFromGrantTree,
} from "./access-tags";
import { runWithWorkspaceContext } from "./workspace-context";

describe("tags in the permission tree", () => {
	test("reads only the tag kind, ignoring method grants", () => {
		const tree: GrantTree = {
			rp: { community: { listTopics: "r" } },
			tg: { "team-support": "rw", moderator: "rwx" },
		};
		expect(tagsFromGrantTree(tree)).toEqual(["team-support", "moderator"]);
	});

	test("narrows to grants carrying the asked mode", () => {
		const tree: GrantTree = { tg: { reader: "r", editor: "rw" } };
		expect(tagsFromGrantTree(tree, "w")).toEqual(["editor"]);
	});

	test("an empty or absent tree yields no tags", () => {
		expect(tagsFromGrantTree(undefined)).toEqual([]);
		expect(tagsFromGrantTree({})).toEqual([]);
		expect(tagsFromGrantTree({ rp: { files: { get: "r" } } })).toEqual([]);
	});
});

describe("tags of the acting subject", () => {
	test("the personal tag comes first and needs nothing stored", () => {
		const tags = runWithWorkspaceContext({ user: "u-42-id" }, () =>
			getCurrentAccessTags(),
		);
		expect(tags).toEqual([personalTag("u-42-id")]);
	});

	test("group tags follow the personal one", () => {
		const tags = runWithWorkspaceContext(
			{ user: "alice", accessTags: ["team-support", "moderator"] },
			() => getCurrentAccessTags(),
		);
		expect(tags).toEqual(["u-alice", "team-support", "moderator"]);
	});

	test("an anonymous caller is matched by nothing", () => {
		expect(runWithWorkspaceContext({}, () => getCurrentAccessTags())).toEqual([]);
	});

	test("a tag repeated in the token is listed once", () => {
		const tags = runWithWorkspaceContext(
			{ user: "bob", accessTags: ["team-a", "team-a", " team-a "] },
			() => getCurrentAccessTags(),
		);
		expect(tags).toEqual(["u-bob", "team-a"]);
	});
});
