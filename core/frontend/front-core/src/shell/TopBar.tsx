import type { ComponentChildren } from "preact";

export type TopBarLink = {
	label: string;
	href: string;
	current?: boolean;
};

/**
 * The header row: brand, then either the workspace's tabs or plain links, then
 * controls. What the tabs are is the caller's business — the workspace passes
 * its strip, a landing page passes nothing and gets its links.
 */
export function TopBar({
	brand,
	brandHref,
	onBrandClick,
	tabs,
	links = [],
	controls,
	navigationLabel = "Main navigation",
	isAuthenticated = false,
}: {
	brand: ComponentChildren;
	brandHref?: string;
	onBrandClick?: () => void;
	tabs?: ComponentChildren;
	links?: TopBarLink[];
	controls?: ComponentChildren;
	navigationLabel?: string;
	isAuthenticated?: boolean;
}) {
	return (
		<header
			class="top-bar"
			data-authenticated={isAuthenticated ? "true" : undefined}
		>
			{!isAuthenticated &&
				(onBrandClick ? (
					<button type="button" class="top-bar-brand" onClick={onBrandClick}>
						{brand}
					</button>
				) : (
					<a class="top-bar-brand" href={brandHref}>
						{brand}
					</a>
				))}

			{tabs ? (
				<div class="top-bar-tabstrip">{tabs}</div>
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
