import { describe, expect, test } from "bun:test";
import { groupPinnedViews } from "./pinned-view-groups";
import type { WorkspaceTab } from "./workspace";

function view(key: string, owner: string, pinned: boolean): WorkspaceTab {
	return {
		key,
		owner,
		title: key,
		view: (() => null) as WorkspaceTab["view"],
		props: {},
		pinned,
	};
}

describe("groupPinnedViews", () => {
	test("keeps only pinned views and groups them by surface", () => {
		const groups = groupPinnedViews([
			view("companies", "sf-companies", true),
			view("mail-a", "sf-mailing", true),
			view("mail-b", "rp-mailing", true),
			view("transient", "sf-mailing", false),
		]);

		expect(groups.map(({ tag }) => tag)).toEqual(["companies", "mailing"]);
		expect(groups[1]?.views.map(({ key }) => key)).toEqual([
			"mail-a",
			"mail-b",
		]);
	});
});
