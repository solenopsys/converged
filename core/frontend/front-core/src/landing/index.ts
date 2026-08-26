export {
	AssistantStageBlock,
	type AssistantStageData,
} from "./blocks/AssistantStageBlock";
export {
	BusinessImpactBlock,
	type BusinessImpactData,
	type BusinessImpactMetric,
} from "./blocks/BusinessImpactBlock";
export { useState as useLandingState } from "preact/hooks";
export {
	CertificatesBlock,
	CncHeroRequestBlock,
	CncRailBlock,
	ContactsMapBlock,
	ReviewsBlock,
	SalesIslandBlock,
	ShopProofBlock,
	type CertificatesData,
	type CncHeroData,
	type CncRailData,
	type ContactsData,
	type ReviewsData as CncReviewsData,
	type SalesIslandData,
	type ShopProofData,
} from "./blocks/CncLandingBlocks";
export { HeroBlock, type HeroData } from "./blocks/HeroBlock";
export {
	VectorImage,
	type VectorImageData,
	type VectorImageLabel,
	type VectorImageSettings,
	type VectorTool,
} from "./blocks/VectorImage";
export { VectorImageBlock } from "./blocks/VectorImageBlock";
export {
	type DiagramsData,
	ProductCasesBlock,
	type ProductCase,
	type ProductCasesData,
} from "./blocks/ProductCasesBlock";
export { LandingView } from "./LandingView";
export { LandingLayout } from "./LandingLayout";
export { LandingHeader, type LandingHeaderLink } from "./LandingHeader";
export { LocalePicker } from "./LocalePicker";
export {
	type BlockContext,
	type LandingBlock,
	type LandingBlockMap,
	type LandingHeaderRenderer,
	registerLandingBlocks,
	registerLandingHeader,
	renderBlock,
	renderLandingHeader,
} from "./registry";
export type {
	LandingBlockConfig,
	LandingConfig,
	LandingMenuLink,
	LandingNavigationConfig,
	LandingPayload,
	ResolvedBlock,
} from "./types";
export {
	AVAILABLE_LANGS,
	buildLocalePath,
	DEFAULT_LOCALE,
	detectBrowserLocale,
	extractLocaleFromPath,
	isSupportedLocale,
	SUPPORTED_LOCALES,
	type LangItem,
	type SupportedLocale,
} from "./i18n";
