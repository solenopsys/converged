import type { ComponentChildren } from "preact";
import { Fragment } from "preact";
import { AnalyticsContentBoundary } from "../analytics/AnalyticsContentBoundary";
import { LandingLayout } from "./LandingLayout";
import { renderBlock } from "./registry";
import type { LandingPayload } from "./types";

export function LandingView({
	payload,
	composer,
	hidden,
}: {
	payload: LandingPayload;
	composer?: ComponentChildren;

	hidden?: boolean;
}) {
	const menu = payload.navigation?.menuLinks;
	const context = {
		composer,
		menu,
		locale: payload.locale,
		pathname: payload.pathname,
	};

	return (
		<LandingLayout context={context} hidden={hidden}>
			{payload.blocks.map((block) => (
				<Fragment key={block.id}>
					<AnalyticsContentBoundary
						contentId={block.id}
						contentType="landing_block"
					>
						{renderBlock(block, context)}
					</AnalyticsContentBoundary>
				</Fragment>
			))}
		</LandingLayout>
	);
}
