import { resolve } from "node:path";
import type { ServerApp } from "back-core/server-app";
import type { ResolvedBlock } from "front-core/landing";
import { registerLandingBlocks, registerLandingHeader } from "front-core/landing";
import ssrPlugin from "front-ssr/plugin";
import { loadProductCaseMarkdown } from "front-ssr/product-cases-markdown";
import { blocks, header } from "./blocks";



const LANDING_CONFIG = "product/landing/cnc-landing.json";

export interface LandingPluginConfig {
	production?: boolean;
	publicDir?: string;
}

function readLocale(): string {
	const locale = process.env.FRONT_LOCALE?.trim();
	if (!locale) throw new Error("[landing] missing required env FRONT_LOCALE");
	return locale;
}

export default function landingPlugin(config: LandingPluginConfig = {}) {
	const landingRoot = resolve(import.meta.dir, "..");
	const locale = readLocale();
	const configPath =
		process.env.LANDING_CONFIG_PATH?.trim() || `${locale}/${LANDING_CONFIG}`;

	registerLandingBlocks(blocks);
	registerLandingHeader(header);

	const ssr = ssrPlugin({
		production: config.production,
		publicDir: config.publicDir ?? resolve(landingRoot, "public"),
		landingConfigPath: () => configPath,
		locale,
		blockData: {
			"product-cases": (block: ResolvedBlock, { workspace }) =>
				loadProductCaseMarkdown(block, locale, workspace),
		},
		sitemapRoutes: [{ path: "/", changefreq: "weekly", priority: 1 }],
		themeColor: "#f7f7f5",
	});

	return (app: ServerApp) => {
		ssr(app);
		return app;
	};
}
