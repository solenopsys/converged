/**
 * Sales Island — interactive React shell.
 *
 * Owns an effector model (one per instance) for the expanded/collapsed state and
 * exposes it through `data-open` on the root, the exact same contract the vanilla
 * hydration island drives. Renders the desktop dock (bar + panel) and the mobile
 * shell (pill + sheet); CSS decides which is visible at a given width.
 *
 * SSR-safe: with no event handlers attached (static markup) it renders the
 * collapsed — or `defaultExpanded` — state, and the island takes over on hydrate.
 */

import { useUnit } from "effector-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { createSalesIslandModel } from "./model";
import { SalesIslandBar } from "./SalesIslandBar";
import { SalesIslandMobile } from "./SalesIslandMobile";
import { SalesIslandPanel } from "./SalesIslandPanel";
import type { SalesIslandData } from "./types";
import "./SalesIsland.css";

export function SalesIsland({
	className,
	data,
}: {
	className?: string;
	data: SalesIslandData;
}) {
	const [model] = useState(() => createSalesIslandModel(data.defaultExpanded));
	const open = useUnit(model.$open);

	const placement = data.placement ?? "fixed";

	return (
		<div
			className={cn("sales-island", className)}
			data-sales-island
			data-open={open ? "true" : "false"}
			data-placement={placement}
		>
			<div className="sales-island__dock">
				<SalesIslandPanel data={data} />
				<SalesIslandBar
					data={data}
					expanded={open}
					onToggle={() => model.toggled()}
				/>
			</div>

			<SalesIslandMobile
				data={data}
				onOpen={() => model.opened()}
				onClose={() => model.closed()}
			/>

			<button
				type="button"
				className="sales-island__scrim"
				data-sales-island-scrim
				aria-hidden="true"
				tabIndex={-1}
				onClick={() => model.closed()}
			/>
		</div>
	);
}
