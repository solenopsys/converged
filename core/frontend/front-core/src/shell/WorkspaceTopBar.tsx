import type { ComponentChildren } from "preact";
import { TabBar } from "../tabs";
import { TopBar, type TopBarLink } from "./TopBar";
import { TopBarSettings } from "./TopBarControls";
import { surfaceBarText, surfaceStrip } from "./workspace-bars";

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
	return (
		<TopBar
			brand={brand}
			brandHref={brandHref}
			onBrandClick={onBrandClick}
			// Always the strip, even empty: its catalog is how the first section is opened.
			tabs={
				<TabBar model={surfaceStrip} theme="strip" text={surfaceBarText()} />
			}
			links={links}
			controls={
				<>
					{controls}
					<TopBarSettings />
				</>
			}
		/>
	);
}
