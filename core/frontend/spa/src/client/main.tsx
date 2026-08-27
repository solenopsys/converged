import {
	type LandingPayload,
	registerLandingBlocks,
	registerLandingHeader,
} from "front-core/landing";
import { AppShell, bootstrapAppShell } from "front-core/shell";
import { render } from "preact";
import { blocks, BrandLogo, header } from "./landing-blocks";

function readLandingPayload(): LandingPayload {
	const element = document.getElementById("__INITIAL_DATA__");
	if (!element?.textContent)
		throw new Error("[spa] missing SSR landing payload");

	const initial = JSON.parse(element.textContent) as {
		landing?: LandingPayload;
	};
	if (!initial.landing || !Array.isArray(initial.landing.blocks)) {
		throw new Error("[spa] invalid SSR landing payload");
	}
	return initial.landing;
}

const route =
	window.location.pathname.replace(/^\/(?:en|ru|de|fr|es|it|pt)(?=\/|$)/, "") ||
	"/";

if (route === "/audit" || route === "/audit/print") {
	void import("audit")
		.then(({ hasAuditPage, bootstrapAudit, bootstrapAuditPrint }) => {
			if (!hasAuditPage) return;
			if (route === "/audit/print") bootstrapAuditPrint();
			else bootstrapAudit();
		})
		.catch((error) => {
			console.error("[spa] failed to initialize audit", error);
		});
} else {
	const root = document.getElementById("app");
	if (!root) throw new Error("Missing #app root");

	registerLandingBlocks(blocks);
	registerLandingHeader(header);

	void bootstrapAppShell((config) => {
		// SSR provides a landing placeholder only; the interactive shell has browser
		// dependencies and must own the mounted tree instead of hydrating a different one.
		render(
			<AppShell
				config={config}
				landing={readLandingPayload()}
				brand={<BrandLogo />}
			/>,
			root,
		);
	}).catch((error) => {
		console.error("[spa] failed to initialize auth", error);
	});
}
