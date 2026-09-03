import { themeBootstrapScript } from "front-core";
import type { LandingPayload } from "front-core/landing";
import { LandingView } from "front-core/landing";
import { AppShellFrame } from "front-core/shell";
import type { Counter } from "g-counters";
import type { MountConfig } from "../mount-config";
import { AnalyticsScript } from "./Analytics";

export type SeoConfig = {
	title: string;
	description: string;
	keywords: string[];
	canonical?: string;
	ogImage?: string;
};

function serializeInitialData(landing?: LandingPayload): string {
	return JSON.stringify(landing ? { landing } : {})
		.replace(/</g, "\\u003c")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}

export function Document({
	lang,
	seo,
	mount,
	landing,
	themeColor,
	counters,
}: {
	lang: string;
	seo: SeoConfig;
	mount: MountConfig;
	landing?: LandingPayload;
	themeColor: string;
	// Analytics counters, resolved from ms-counters (CountersService) by scope at SSR.
	counters: Counter[];
}) {
	const keywords = seo.keywords.filter(Boolean).join(", ");

	return (
		<html lang={lang}>
			<head>
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: static pre-paint theme bootstrap
					dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
				/>
				<meta charSet="UTF-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1.0, viewport-fit=cover"
				/>
				<meta name="theme-color" content={themeColor} />
				<AnalyticsScript counters={counters} />
				<title>{seo.title}</title>
				{seo.description ? (
					<meta name="description" content={seo.description} />
				) : null}
				{keywords ? <meta name="keywords" content={keywords} /> : null}
				<meta name="robots" content="index,follow" />
				{seo.canonical ? <link rel="canonical" href={seo.canonical} /> : null}
				<meta property="og:type" content="website" />
				<meta property="og:title" content={seo.title} />
				{seo.description ? (
					<meta property="og:description" content={seo.description} />
				) : null}
				{seo.canonical ? (
					<meta property="og:url" content={seo.canonical} />
				) : null}
				{seo.ogImage ? (
					<meta property="og:image" content={seo.ogImage} />
				) : null}
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
			</head>
			<body>
				<script
					id="__INITIAL_DATA__"
					type="application/json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: serialized initial-screen data
					dangerouslySetInnerHTML={{ __html: serializeInitialData(landing) }}
				/>
				<AppShellFrame mount={mount}>
					{landing ? <LandingView payload={landing} /> : null}
				</AppShellFrame>
			</body>
		</html>
	);
}
