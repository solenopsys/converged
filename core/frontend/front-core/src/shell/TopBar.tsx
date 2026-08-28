import type { ComponentChildren } from "preact";
import { TabStrip, type TopBarTab } from "./TabStrip";

export type TopBarLink = {
	label: string;
	href: string;
	current?: boolean;
};

export type { TopBarTab };


export function TopBar({
	brand,
	brandHref,
	onBrandClick,
	tabs = [],
	links = [],
	onTabSelect,
	onTabClose,
	onTabPinToggle,
	onTabAction,
	controls,
	navigationLabel = "Main navigation",
	tabsLabel = "Workspace tabs",
}: {
	brand: ComponentChildren;
	brandHref?: string;
	onBrandClick?: () => void;
	tabs?: TopBarTab[];
	links?: TopBarLink[];
	onTabSelect?: (key: string) => void;
	onTabClose?: (key: string) => void;
	onTabPinToggle?: (key: string) => void;
	onTabAction?: (key: string, actionId: string) => void;
	controls?: ComponentChildren;
	navigationLabel?: string;
	tabsLabel?: string;
}) {
	return (
		<header class="top-bar">
			{onBrandClick ? (
				<button type="button" class="top-bar-brand" onClick={onBrandClick}>
					{brand}
				</button>
			) : (
				<a class="top-bar-brand" href={brandHref}>
					{brand}
				</a>
			)}

			{tabs.length > 0 ? (
				<TabStrip
					tabs={tabs}
					label={tabsLabel}
					onSelect={onTabSelect}
					onClose={onTabClose}
					onPinToggle={onTabPinToggle}
					onAction={onTabAction}
				/>
			) : (
				<nav class="top-bar-nav" aria-label={navigationLabel}>
					{links.map((link) => (
						<a
							key={link.href}
							href={link.href}
							aria-current={link.current ? "page" : undefined}
						>
							{link.label}
						</a>
					))}
				</nav>
			)}

			<div class="top-bar-controls">{controls}</div>
		</header>
	);
}
