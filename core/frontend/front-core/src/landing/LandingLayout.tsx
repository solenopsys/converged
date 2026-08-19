import type { ComponentChildren } from "preact";
import { renderLandingHeader, type BlockContext } from "./registry";

export function LandingLayout({
	context,
	children,
	hidden,
}: {
	context: BlockContext;
	children: ComponentChildren;
	hidden?: boolean;
}) {
	return (
		<div class="landing-surface" hidden={hidden}>
			{renderLandingHeader(context)}
			{children}
		</div>
	);
}
