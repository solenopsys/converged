/**
 * Sales Island — desktop bar (always visible, collapsed state).
 */

import { SalesIslandIcon } from "./icons";
import {
	InlineContent,
	SalesIslandCtaButton,
	SalesIslandMark,
	SalesIslandPriceTag,
} from "./parts";
import type { SalesIslandData } from "./types";

export function SalesIslandBar({
	data,
	expanded = false,
	onToggle,
}: {
	data: SalesIslandData;
	expanded?: boolean;
	onToggle?: () => void;
}) {
	const expandLabel = data.toggle?.expand ?? "See how it works";

	return (
		<div className="sales-island__bar">
			<SalesIslandMark data={data} className="sales-island__bar-mark" />

			<div className="sales-island__bar-copy">
				<div className="sales-island__bar-title">
					{data.barTitle ?? data.title}
				</div>
				{data.barCopy ? (
					<div className="sales-island__bar-sub">
						<InlineContent value={data.barCopy} />
					</div>
				) : null}
			</div>

			<SalesIslandPriceTag
				price={data.price}
				className="sales-island__price--bar"
			/>

			<div className="sales-island__bar-actions">
				<button
					type="button"
					className="sales-island__btn sales-island__btn--ghost"
					aria-expanded={expanded}
					data-sales-island-toggle
					onClick={onToggle}
				>
					<span>{expandLabel}</span>
					<SalesIslandIcon
						name="chevron"
						className="sales-island__chevron"
						strokeWidth={2.4}
					/>
				</button>
				<SalesIslandCtaButton cta={data.primaryCta} />
			</div>
		</div>
	);
}
