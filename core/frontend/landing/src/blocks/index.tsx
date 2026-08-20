import {
	AssistantStageBlock,
	BusinessImpactBlock,
	CertificatesBlock,
	CncHeroRequestBlock,
	CncRailBlock,
	ContactsMapBlock,
	type AssistantStageData,
	type BusinessImpactData,
	type DiagramsData,
	HeroBlock,
	type HeroData,
	LandingHeader,
	type LandingHeaderRenderer,
	type LandingBlockMap,
	ProductCasesBlock,
	ReviewsBlock,
	SalesIslandBlock,
	ShopProofBlock,
	type CertificatesData,
	type CncHeroData,
	type CncRailData,
	type ContactsData,
	type CncReviewsData,
	type SalesIslandData,
	type ShopProofData,
	type ProductCasesData,
} from "front-core/landing";


export const brand = "4IR";

export const header: LandingHeaderRenderer = (context) => (
	<LandingHeader brand={brand} brandHref="#product" links={context.menu ?? []} />
);


export const blocks: LandingBlockMap = {
	"cnc-hero-request": (block, context) => (
		<CncHeroRequestBlock id={block.id} data={block.data.intake as CncHeroData} composer={context.composer} />
	),
	"shop-proof": (block) => <ShopProofBlock id={block.id} data={block.data.proof as ShopProofData} />,
	"section-rail": (block) => <CncRailBlock id={block.id} data={block.data.rail as CncRailData} />,
	reviews: (block) => <ReviewsBlock id={block.id} data={block.data.reviews as CncReviewsData} />,
	certificates: (block) => <CertificatesBlock id={block.id} data={block.data.certificates as CertificatesData} />,
	"contacts-map": (block) => <ContactsMapBlock id={block.id} data={block.data.contacts as ContactsData} />,
	"sales-island": (block) => <SalesIslandBlock id={block.id} data={block.data.island as SalesIslandData} />,
	hero: (block, context) => (
		<HeroBlock
			id={block.id}
			data={block.data.hero as HeroData}
			composer={context.composer}
			menu={context.menu}
		/>
	),
	"assistant-stage": (block) => (
		<AssistantStageBlock id={block.id} data={block.data.stage as AssistantStageData} />
	),
	"business-impact": (block) => (
		<BusinessImpactBlock id={block.id} data={block.data.impact as BusinessImpactData} />
	),
	"product-cases": (block) => (
		<ProductCasesBlock
			id={block.id}
			data={block.data.cases as ProductCasesData}
			diagrams={block.data.diagrams as DiagramsData}
		/>
	),
};
