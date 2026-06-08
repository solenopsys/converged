/**
 * Sales Island — config-driven landing block.
 *
 * The single entry point used by the landing renderer and Storybook. It takes the
 * JSON `data`, renders the interactive React shell, and marks the subtree as an
 * island (`data-island="sales-island"`) so the SSR-static output can be hydrated
 * by the lightweight vanilla island. Mirrors the LandingSectionRailBlock pattern.
 */

import { SalesIsland } from "./SalesIsland";
import type { SalesIslandData } from "./types";

export function SalesIslandBlock({
	className,
	data,
}: {
	className?: string;
	data?: SalesIslandData;
}) {
	if (!data || data.enabled === false) return null;

	const islandProps = JSON.stringify({
		defaultExpanded: data.defaultExpanded ?? false,
	});

	return (
		<div
			className={className}
			data-island="sales-island"
			data-island-load="eager"
			data-island-props={islandProps}
		>
			<SalesIsland data={data} />
		</div>
	);
}
