/**
 * Sales Island — desktop expandable detail panel (revealed above the bar).
 *
 * Four columns: the featured lead column, what's-included grid, how-it-works
 * steps, and the maker / guarantee / admin column.
 */

import { SalesIslandIcon } from "./icons";
import {
	InlineContent,
	SalesIslandAdminLink,
	SalesIslandFeatures,
	SalesIslandGuaranteeNote,
	SalesIslandMakerCard,
	SalesIslandPriceTag,
	SalesIslandSteps,
} from "./parts";
import type { SalesIslandData } from "./types";

export function SalesIslandPanel({ data }: { data: SalesIslandData }) {
	return (
		<div className="sales-island__panel">
			<div className="sales-island__panel-inner">
				<SalesIslandLeadColumn data={data} />

				<div className="sales-island__panel-col">
					<SalesIslandFeatures group={data.included} />
				</div>

				<div className="sales-island__panel-col">
					<SalesIslandSteps group={data.steps} />
				</div>

				<div className="sales-island__panel-col">
					{data.maker?.title ? (
						<h4 className="sales-island__block-title">{data.maker.title}</h4>
					) : null}
					<SalesIslandMakerCard maker={data.maker} />
					<SalesIslandGuaranteeNote guarantee={data.guarantee} />
					<SalesIslandAdminLink link={data.adminLink} />
				</div>
			</div>
		</div>
	);
}

function SalesIslandLeadColumn({ data }: { data: SalesIslandData }) {
	return (
		<div className="sales-island__panel-col sales-island__lead-col">
			{data.eyebrow ? (
				<span className="sales-island__eyebrow">
					<SalesIslandIcon
						name={data.eyebrowIcon ?? "spark"}
						strokeWidth={2.4}
					/>
					<InlineContent value={data.eyebrow} />
				</span>
			) : null}
			<h3 className="sales-island__lead-title">{data.title}</h3>
			{data.lead ? (
				<p className="sales-island__lead-text">
					<InlineContent value={data.lead} />
				</p>
			) : null}
			<SalesIslandPriceTag
				price={data.price}
				className="sales-island__price--lead"
			/>
		</div>
	);
}
