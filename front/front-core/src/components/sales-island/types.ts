/**
 * Sales Island — config-driven data contract.
 *
 * Everything user-facing here is plain data so it can live in struct JSON and be
 * localized. Icons are referenced by name (see `icons.tsx`) instead of inlined
 * SVG so the JSON stays small and translatable.
 */

export type SalesIslandIconName =
	| "robot"
	| "spark"
	| "chat"
	| "rfq"
	| "upload"
	| "leads"
	| "hosting"
	| "setup"
	| "updates"
	| "phone"
	| "shield"
	| "key"
	| "arrow"
	| "chevron"
	| "close";

export type SalesIslandInlinePart = {
	text: string;
	strong?: boolean;
	emphasis?: boolean;
};

/** Either a flat string or rich inline parts (for bold/emphasis spans). */
export type SalesIslandInlineContent = string | SalesIslandInlinePart[];

export type SalesIslandPrice = {
	/** Headline amount, already formatted: "$288". */
	amount: string;
	/** Optional suffix shown smaller: "/year". */
	period?: string;
	/** Short reassurance line: "14-day money-back guarantee". */
	note?: string;
};

export type SalesIslandFeature = {
	id: string;
	label: string;
	icon?: SalesIslandIconName;
};

export type SalesIslandFeatureGroup = {
	title?: string;
	items: SalesIslandFeature[];
};

export type SalesIslandStep = {
	id: string;
	body: SalesIslandInlineContent;
};

export type SalesIslandStepGroup = {
	title?: string;
	items: SalesIslandStep[];
};

export type SalesIslandMaker = {
	title?: string;
	/** Short badge text / initials shown in the avatar tile: "4". */
	badge?: string;
	name: string;
	by?: string;
};

export type SalesIslandGuarantee = {
	icon?: SalesIslandIconName;
	text: SalesIslandInlineContent;
};

export type SalesIslandLink = {
	label: string;
	href: string;
	icon?: SalesIslandIconName;
};

export type SalesIslandCta = {
	label: string;
	href?: string;
	icon?: SalesIslandIconName;
};

export type SalesIslandToggleLabels = {
	/** Collapsed → expanded trigger: "See how it works". */
	expand: string;
	/** Expanded → collapsed trigger: "Collapse". */
	collapse: string;
};

export type SalesIslandPlacement = "fixed" | "stage";

export type SalesIslandData = {
	/** Set to false in config to render nothing. */
	enabled?: boolean;
	/** Pinned to the viewport ("fixed", default) or absolute inside a wrapper ("stage"). */
	placement?: SalesIslandPlacement;
	defaultExpanded?: boolean;

	/** Small tag above the headline in the expanded panel: "replace your website". */
	eyebrow?: SalesIslandInlineContent;
	eyebrowIcon?: SalesIslandIconName;
	/** Logo mark icon shown in the bar / mobile pill. */
	mark?: SalesIslandIconName;
	/** Brand line shown in the mobile fullscreen header: "4ir.club · demo". */
	brand?: string;

	title: string;
	/** Long-form description shown in the expanded panel and mobile fullscreen. */
	lead?: SalesIslandInlineContent;
	/** Bar headline override (defaults to `title`). */
	barTitle?: string;
	/** Bar subline (collapsed bar). */
	barCopy?: SalesIslandInlineContent;
	/** Compact subline for the mobile pill. */
	mobileCopy?: SalesIslandInlineContent;

	price: SalesIslandPrice;
	primaryCta: SalesIslandCta;
	toggle?: SalesIslandToggleLabels;

	included?: SalesIslandFeatureGroup;
	steps?: SalesIslandStepGroup;
	maker?: SalesIslandMaker;
	guarantee?: SalesIslandGuarantee;
	adminLink?: SalesIslandLink;
};
