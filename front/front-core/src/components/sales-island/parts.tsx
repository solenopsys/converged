/**
 * Sales Island — shared presentational parts.
 *
 * Small, stateless building blocks composed by the desktop and mobile shells.
 * They never reach for state; everything comes in through props/config so the
 * same pieces render identically in SSR, React and the hydration island.
 */

import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { SalesIslandIcon } from "./icons";
import type {
	SalesIslandCta,
	SalesIslandFeatureGroup,
	SalesIslandGuarantee,
	SalesIslandInlineContent,
	SalesIslandLink,
	SalesIslandMaker,
	SalesIslandPrice,
	SalesIslandStepGroup,
} from "./types";

export function InlineContent({
	value,
}: {
	value?: SalesIslandInlineContent;
}): ReactNode {
	if (!value) return null;
	if (typeof value === "string") return value;

	return value.map((part, index) => {
		const key = `${part.text}-${index}`;
		if (part.strong) return <strong key={key}>{part.text}</strong>;
		if (part.emphasis) return <em key={key}>{part.text}</em>;
		return <span key={key}>{part.text}</span>;
	});
}

export function SalesIslandMark({
	data,
	className,
}: {
	data: { mark?: import("./types").SalesIslandIconName };
	className?: string;
}) {
	return (
		<span className={cn("sales-island__mark", className)} aria-hidden="true">
			<SalesIslandIcon name={data.mark ?? "robot"} strokeWidth={2} />
		</span>
	);
}

export function SalesIslandPriceTag({
	price,
	className,
}: {
	price: SalesIslandPrice;
	className?: string;
}) {
	return (
		<div className={cn("sales-island__price", className)}>
			<div className="sales-island__price-amount">
				{price.amount}
				{price.period ? (
					<span className="sales-island__price-period">{price.period}</span>
				) : null}
			</div>
			{price.note ? (
				<div className="sales-island__price-note">{price.note}</div>
			) : null}
		</div>
	);
}

export function SalesIslandFeatures({
	group,
}: {
	group?: SalesIslandFeatureGroup;
}) {
	if (!group?.items?.length) return null;

	return (
		<div className="sales-island__block sales-island__features">
			{group.title ? (
				<h4 className="sales-island__block-title">{group.title}</h4>
			) : null}
			<ul className="sales-island__features-grid">
				{group.items.map((feature) => (
					<li className="sales-island__feature" key={feature.id}>
						<span className="sales-island__feature-icon" aria-hidden="true">
							<SalesIslandIcon name={feature.icon} />
						</span>
						<span className="sales-island__feature-label">{feature.label}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export function SalesIslandSteps({ group }: { group?: SalesIslandStepGroup }) {
	if (!group?.items?.length) return null;

	return (
		<div className="sales-island__block sales-island__steps">
			{group.title ? (
				<h4 className="sales-island__block-title">{group.title}</h4>
			) : null}
			<ol className="sales-island__steps-list">
				{group.items.map((step, index) => (
					<li className="sales-island__step" key={step.id}>
						<span className="sales-island__step-number" aria-hidden="true">
							{index + 1}
						</span>
						<span className="sales-island__step-body">
							<InlineContent value={step.body} />
						</span>
					</li>
				))}
			</ol>
		</div>
	);
}

export function SalesIslandGuaranteeNote({
	guarantee,
}: {
	guarantee?: SalesIslandGuarantee;
}) {
	if (!guarantee) return null;

	return (
		<div className="sales-island__guarantee">
			<SalesIslandIcon
				name={guarantee.icon ?? "shield"}
				className="sales-island__guarantee-icon"
			/>
			<p className="sales-island__guarantee-text">
				<InlineContent value={guarantee.text} />
			</p>
		</div>
	);
}

export function SalesIslandMakerCard({ maker }: { maker?: SalesIslandMaker }) {
	if (!maker) return null;

	return (
		<div className="sales-island__maker">
			{maker.badge ? (
				<span className="sales-island__maker-badge" aria-hidden="true">
					{maker.badge}
				</span>
			) : null}
			<span className="sales-island__maker-text">
				<span className="sales-island__maker-name">{maker.name}</span>
				{maker.by ? (
					<span className="sales-island__maker-by">{maker.by}</span>
				) : null}
			</span>
		</div>
	);
}

export function SalesIslandAdminLink({ link }: { link?: SalesIslandLink }) {
	if (!link) return null;

	return (
		<a className="sales-island__admin-link" href={link.href}>
			<SalesIslandIcon
				name={link.icon ?? "key"}
				className="sales-island__admin-icon"
			/>
			{link.label}
		</a>
	);
}

export function SalesIslandCtaButton({
	cta,
	className,
	variant = "primary",
}: {
	cta: SalesIslandCta;
	className?: string;
	variant?: "primary" | "ghost";
}) {
	const content = (
		<>
			<span>{cta.label}</span>
			<SalesIslandIcon name={cta.icon ?? "arrow"} strokeWidth={2.5} />
		</>
	);
	const classes = cn(
		"sales-island__btn",
		variant === "primary"
			? "sales-island__btn--primary"
			: "sales-island__btn--ghost",
		className,
	);

	if (cta.href) {
		return (
			<a className={classes} href={cta.href} data-sales-island-pay>
				{content}
			</a>
		);
	}

	return (
		<button className={classes} type="button" data-sales-island-pay>
			{content}
		</button>
	);
}
