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
	test("keeps only pinned views and groups them by microfrontend", () => {
		const groups = groupPinnedViews([
			view("companies", "mf-companies", true),
			view("mail-a", "mf-mailing", true),
			view("mail-b", "ms-mailing", true),
			view("transient", "mf-mailing", false),
		]);

		expect(groups.map(({ tag }) => tag)).toEqual(["companies", "mailing"]);
		expect(groups[1]?.views.map(({ key }) => key)).toEqual([
			"mail-a",
			"mail-b",
		]);
	});
});
