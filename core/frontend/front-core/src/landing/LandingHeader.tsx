import type { ComponentChildren } from "preact";
import { TopBar, type TopBarLink } from "../shell/TopBar";
import { ThemeToggle, TopBarSettings } from "../shell/TopBarControls";

export type LandingHeaderLink = TopBarLink;


export function LandingHeader({
	brand,
	brandHref,
	links,
	controls,
	navigationLabel = "Main navigation",
}: {
	brand: ComponentChildren;
	brandHref: string;
	links: LandingHeaderLink[];
	controls?: ComponentChildren;
	navigationLabel?: string;
}) {
	return (
		<TopBar
			brand={brand}
			brandHref={brandHref}
			links={links}
			navigationLabel={navigationLabel}
			controls={
				<>
					{controls}
					{controls ? <ThemeToggle /> : <TopBarSettings />}
				</>
			}
		/>
	);
}
