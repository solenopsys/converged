/**
 * Sales Island — mobile shell.
 *
 * Collapsed: a compact pill pinned to the bottom. Expanded: a full-screen sheet
 * with the complete offer. Both states are rendered and toggled via the shared
 * `data-open` attribute on the island root so the same effector state drives
 * desktop and mobile.
 */

import { SalesIslandIcon } from "./icons";
import {
	InlineContent,
	SalesIslandAdminLink,
	SalesIslandCtaButton,
	SalesIslandFeatures,
	SalesIslandGuaranteeNote,
	SalesIslandMakerCard,
	SalesIslandMark,
	SalesIslandPriceTag,
} from "./parts";
import type { SalesIslandData } from "./types";

export function SalesIslandMobile({
	data,
	onOpen,
	onClose,
}: {
	data: SalesIslandData;
	onOpen?: () => void;
	onClose?: () => void;
}) {
	return (
		<div className="sales-island__mobile">
			<SalesIslandMobilePill data={data} onOpen={onOpen} />
			<SalesIslandMobileSheet data={data} onClose={onClose} />
		</div>
	);
}

function SalesIslandMobilePill({
	data,
	onOpen,
}: {
	data: SalesIslandData;
	onOpen?: () => void;
}) {
	return (
		<button
			type="button"
			className="sales-island__pill"
			data-sales-island-open
			onClick={onOpen}
			aria-label={data.toggle?.expand ?? "See how it works"}
		>
			<SalesIslandMark data={data} className="sales-island__pill-mark" />
			<span className="sales-island__pill-copy">
				<span className="sales-island__pill-title">
					{data.barTitle ?? data.title}
				</span>
				{data.mobileCopy ? (
					<span className="sales-island__pill-sub">
						<InlineContent value={data.mobileCopy} />
					</span>
				) : null}
			</span>
			<span className="sales-island__pill-action" aria-hidden="true">
				<SalesIslandIcon name="chevron" strokeWidth={2.4} />
			</span>
		</button>
	);
}

function SalesIslandMobileSheet({
	data,
	onClose,
}: {
	data: SalesIslandData;
	onClose?: () => void;
}) {
	return (
		<div
			className="sales-island__sheet"
			role="dialog"
			aria-modal="true"
			aria-label={data.title}
		>
			<header className="sales-island__sheet-head">
				<span className="sales-island__sheet-brand">
					<SalesIslandMark data={data} className="sales-island__sheet-mark" />
					{data.brand ? (
						<span className="sales-island__sheet-brand-text">{data.brand}</span>
					) : null}
				</span>
				<button
					type="button"
					className="sales-island__sheet-close"
					data-sales-island-close
					onClick={onClose}
					aria-label={data.toggle?.collapse ?? "Close"}
				>
					<SalesIslandIcon name="close" strokeWidth={2.4} />
				</button>
			</header>

			<div className="sales-island__sheet-body">
				<h2 className="sales-island__sheet-title">{data.title}</h2>
				{data.lead ? (
					<p className="sales-island__sheet-lead">
						<InlineContent value={data.lead} />
					</p>
				) : null}

				<SalesIslandFeatures group={data.included} />

				{data.guarantee ? (
					<div className="sales-island__block">
						<SalesIslandGuaranteeNote guarantee={data.guarantee} />
					</div>
				) : null}

				{data.maker || data.adminLink ? (
					<div className="sales-island__block sales-island__sheet-maker">
						{data.maker?.title ? (
							<h4 className="sales-island__block-title">{data.maker.title}</h4>
						) : null}
						<SalesIslandMakerCard maker={data.maker} />
						<SalesIslandAdminLink link={data.adminLink} />
					</div>
				) : null}
			</div>

			<footer className="sales-island__sheet-foot">
				<SalesIslandPriceTag
					price={data.price}
					className="sales-island__price--sheet"
				/>
				<SalesIslandCtaButton
					cta={data.primaryCta}
					className="sales-island__btn--block"
				/>
			</footer>
		</div>
	);
}
