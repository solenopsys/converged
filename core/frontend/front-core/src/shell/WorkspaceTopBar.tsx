import { useUnit } from "effector-preact";
import type { ComponentChildren } from "preact";
import { TopBar, type TopBarLink } from "./TopBar";
import { TopBarSettings } from "./TopBarControls";
import { $workspaceTabViews } from "./tab-actions";
import { workspaceTabActivated, workspaceTabPinToggled } from "./workspace";

export function WorkspaceTopBar({
	brand,
	brandHref,
	onBrandClick,
	links,
	controls,
}: {
	brand: ComponentChildren;
	brandHref?: string;
	onBrandClick?: () => void;
	links?: TopBarLink[];
	controls?: ComponentChildren;
}) {
	const tabs = useUnit($workspaceTabViews)
		.filter((tab) => !tab.pinned)
		.map(({ actions: _actions, ...tab }) => ({ ...tab, actions: [] }));

	return (
		<TopBar
			brand={brand}
			brandHref={brandHref}
			onBrandClick={onBrandClick}
			tabs={tabs}
			links={links}
			onTabSelect={workspaceTabActivated}
			onTabPinToggle={workspaceTabPinToggled}
			controls={
				<>
					{controls}
					<TopBarSettings />
				</>
			}
		/>
	);
}
