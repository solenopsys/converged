import { useUnit } from "effector-preact";
import { Pin, X } from "../icons";
import { groupPinnedViews } from "./pinned-view-groups";
import {
	$activeWorkspaceTabKey,
	$workspaceTabs,
	workspaceTabActivated,
	workspaceTabClosed,
	workspaceTabPinToggled,
} from "./workspace";

export function PinnedViews() {
	const tabs = useUnit($workspaceTabs);
	const activeKey = useUnit($activeWorkspaceTabKey);
	const groups = groupPinnedViews(tabs);

	if (groups.length === 0) {
		return <p class="panel-empty-state">No saved views.</p>;
	}

	return (
		<div class="pinned-views">
			{groups.map((group) => (
				<section class="pinned-view-group" key={group.tag}>
					<h2>#{group.tag}</h2>
					<ol>
						{group.views.map((view) => (
							<li
								key={view.key}
								data-active={view.key === activeKey ? "true" : undefined}
							>
								<button
									type="button"
									class="pinned-view-open"
									onClick={() => workspaceTabActivated(view.key)}
								>
									{view.title}
								</button>
								<div class="pinned-view-actions">
									<button
										type="button"
										aria-label={`Unpin ${view.title}`}
										title="Unpin"
										onClick={() => workspaceTabPinToggled(view.key)}
									>
										<Pin aria-hidden="true" size={14} />
									</button>
									<button
										type="button"
										aria-label={`Close ${view.title}`}
										title="Close"
										onClick={() => workspaceTabClosed(view.key)}
									>
										<X aria-hidden="true" size={14} />
									</button>
								</div>
							</li>
						))}
					</ol>
				</section>
			))}
		</div>
	);
}

export type { PinnedViewGroup } from "./pinned-view-groups";
export { groupPinnedViews } from "./pinned-view-groups";
