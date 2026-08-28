import { useUnit } from "effector-preact";
import type { ComponentChildren } from "preact";
import { TopBar, type TopBarLink } from "./TopBar";
import { TopBarSettings } from "./TopBarControls";
import { $workspaceTabViews, workspaceTabActionInvoked } from "./tab-actions";
import {
	workspaceReset,
	workspaceTabActivated,
	workspaceTabClosed,
	workspaceTabPinToggled,
} from "./workspace";


export function WorkspaceTopBar({
	brand,
	brandHref,
	links,
	controls,
}: {
	brand: ComponentChildren;
	brandHref?: string;
	links?: TopBarLink[];
	controls?: ComponentChildren;
}) {
	const tabs = useUnit($workspaceTabViews);

	return (
		<TopBar
			brand={brand}
			brandHref={brandHref}

			onBrandClick={tabs.length > 0 ? () => workspaceReset() : undefined}
			tabs={tabs}
			links={links}
			onTabSelect={workspaceTabActivated}
			onTabClose={workspaceTabClosed}
			onTabPinToggle={workspaceTabPinToggled}
			onTabAction={(key, actionId) => workspaceTabActionInvoked({ key, actionId })}
			controls={
				<>
					{controls}
					<TopBarSettings />
				</>
			}
		/>
	);
}
