import { useUnit } from "effector-preact";
import type { ComponentChildren } from "preact";
import { TopBar, type TopBarLink } from "./TopBar";
import { TopBarSettings } from "./TopBarControls";
import { $workspaceTabViews, workspaceTabActionInvoked } from "./tab-actions";
import {
	surfaceActivated,
	surfaceClosed,
	surfacePinToggled,
} from "./workspace";

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
	// Every surface in the strip, pinned ones included: pinning keeps a tab here
	// rather than filing it away somewhere else.
	const tabs = useUnit($workspaceTabViews);

	return (
		<TopBar
			brand={brand}
			brandHref={brandHref}
			onBrandClick={onBrandClick}
			tabs={tabs}
			links={links}
			onTabSelect={surfaceActivated}
			onTabClose={surfaceClosed}
			onTabPinToggle={surfacePinToggled}
			onTabAction={(key, actionId) =>
				workspaceTabActionInvoked({ key, actionId })
			}
			controls={
				<>
					{controls}
					<TopBarSettings />
				</>
			}
		/>
	);
}
