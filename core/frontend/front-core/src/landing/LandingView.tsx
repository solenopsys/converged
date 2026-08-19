import { Fragment } from "preact";
import type { ComponentChildren } from "preact";
import { renderBlock } from "./registry";
import { LandingLayout } from "./LandingLayout";
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
				<Fragment key={block.id}>{renderBlock(block, context)}</Fragment>
			))}
		</LandingLayout>
	);
}
