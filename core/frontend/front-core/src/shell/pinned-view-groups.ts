import type { WorkspaceTab } from "./workspace";

export type PinnedViewGroup = {
	tag: string;
	views: WorkspaceTab[];
};

function tagForOwner(owner: string): string {
	return owner.replace(/^(sf|ms)-/, "") || "workspace";
}

export function groupPinnedViews(
	tabs: readonly WorkspaceTab[],
): PinnedViewGroup[] {
	const groups = new Map<string, WorkspaceTab[]>();
	for (const tab of tabs) {
		if (!tab.pinned) continue;
		const tag = tagForOwner(tab.owner);
		groups.set(tag, [...(groups.get(tag) ?? []), tab]);
	}
	return [...groups.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([tag, views]) => ({
			tag,
			views: [...views].sort((left, right) =>
				left.title.localeCompare(right.title),
			),
		}));
}
