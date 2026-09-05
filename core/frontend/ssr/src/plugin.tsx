import type { ServerApp, ServerPlugin } from "back-core/server-app";
import { tryServeStatic } from "back-core/server-app";
import { resolveWorkspaceFromRequest } from "back-core/workspace-domain";
import type { LandingPayload, ResolvedBlock } from "front-core/landing";
import {
	appScriptTag,
	importMapScript,
	preloadTags,
	pwaBootstrapScript,
	pwaHeadTags,
	stylesheetTags,
} from "front-spa/delivery";
import renderToString from "preact-render-to-string";
import { resolveCounters } from "./analytics";
import { prefetchLanding } from "./landing/prefetch";
import { readMountConfig } from "./mount-config";
import { Document, type SeoConfig } from "./render/Document";
import { loadSeoConfig } from "./seo";
import { buildSitemapXml, type SitemapEntry } from "./sitemap";

export type { SeoConfig } from "./render/Document";
export type { SitemapEntry } from "./sitemap";

export interface SsrPluginConfig {
	publicDir: string;

	landingConfigPath: (pathname: string) => string;

	locale: string | ((pathname: string) => string);
	chatContext?: string | ((pathname: string) => string);
	sitemapRoutes: SitemapEntry[];
	production?: boolean;

	themeColor: string;

	blockData?: Record<
		string,
		(
			block: ResolvedBlock,
			context: { pathname: string; workspace?: string },
		) => Promise<Record<string, unknown>>
	>;
}

function normalizeBaseUrl(value: string): string {
	return value.replace(/\/+$/, "");
}

function resolveRequestOrigin(request: Request): string {
	const url = new URL(request.url);
	const proto = (
		request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
		url.protocol.replace(/:$/, "")
	).toLowerCase();
	const host =
		request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
		request.headers.get("host")?.trim() ||
		url.host;
	return `${proto}://${host}`;
}

async function injectDelivery(html: string): Promise<string> {
	const head = [
		await importMapScript(),
		stylesheetTags(),
		preloadTags(),
		appScriptTag(),
		pwaHeadTags(),
		pwaBootstrapScript(),
	].join("");
	return html.replace("</head>", `${head}</head>`);
}

export default function ssrPlugin(config: SsrPluginConfig): ServerPlugin {
	const isProd = config.production ?? process.env.NODE_ENV === "production";
	const publicDir = config.publicDir;
	const mount = readMountConfig();

	let seo: SeoConfig | null = null;

	const landings = new Map<string, LandingPayload>();

	async function ensureSeo(): Promise<SeoConfig> {
		seo ??= await loadSeoConfig(publicDir);
		return seo;
	}

	async function withBlockData(
		payload: LandingPayload,
		pathname: string,
		workspace?: string,
	): Promise<LandingPayload> {
		const loaders = config.blockData;
		if (!loaders) return payload;

		const blocks = await Promise.all(
			payload.blocks.map(async (block) => {
				const load = loaders[block.type];
				if (!load) return block;
				return {
					...block,
					data: {
						...block.data,
						...(await load(block, { pathname, workspace })),
					},
				};
			}),
		);
		return { ...payload, blocks };
	}

	async function landingPayload(
		pathname: string,
		workspace?: string,
	): Promise<LandingPayload> {
		const configPath = config.landingConfigPath(pathname);
		const locale =
			typeof config.locale === "function"
				? config.locale(pathname)
				: config.locale;
		const known = landings.get(configPath);
		if (
			isProd &&
			!config.blockData &&
			typeof config.locale === "string" &&
			known
		) {
			return known;
		}

		const payload = await withBlockData(
			await prefetchLanding(configPath, workspace),
			pathname,
			workspace,
		);
		const contextualPayload = { ...payload, locale, pathname };
		if (isProd && !config.blockData && typeof config.locale === "string") {
			landings.set(configPath, contextualPayload);
		}
		return contextualPayload;
	}

	function canonical(baseUrl: string, path: string): string {
		const base = normalizeBaseUrl(baseUrl);
		return path === "/" || path === "" ? base : `${base}${path}`;
	}

	function publicOrigin(request: Request): string {
		if (isProd && seo?.canonical?.startsWith("http"))
			return normalizeBaseUrl(seo.canonical);
		return normalizeBaseUrl(resolveRequestOrigin(request));
	}

	function isConsoleRoute(pathname: string): boolean {
		return pathname === "/console" || pathname.startsWith("/console/");
	}

	return (app: ServerApp) => {
		app
			.onStart(async () => {
				await ensureSeo();
			})
			.get("/sitemap.xml", ({ request }) => {
				const origin = publicOrigin(request);
				return new Response(buildSitemapXml(origin, config.sitemapRoutes), {
					headers: {
						"Content-Type": "application/xml; charset=utf-8",
						"Cache-Control": "no-transform",
					},
				});
			})
			.get("/robots.txt", ({ request }) => {
				const origin = publicOrigin(request);
				return new Response(
					["User-agent: *", "Allow: /", `Sitemap: ${origin}/sitemap.xml`].join(
						"\n",
					),
					{ headers: { "Content-Type": "text/plain; charset=utf-8" } },
				);
			});

		app.get("/*", async ({ request, set }) => {
			const url = new URL(request.url);

			const staticResponse = await tryServeStatic(publicDir, url.pathname, {
				"Cache-Control": isProd ? "public, max-age=86400" : "no-store",
			});
			if (staticResponse) return staticResponse;

			if (/\.[a-z0-9]+$/i.test(url.pathname)) {
				set.status = 404;
				return "Not Found";
			}

			try {
				const seoConfig = await ensureSeo();
				const workspace = resolveWorkspaceFromRequest(request);
				const origin = publicOrigin(request);
				const consoleRoute = isConsoleRoute(url.pathname);
				const [payload, counters] = await Promise.all([
					consoleRoute
						? Promise.resolve(undefined)
						: landingPayload(url.pathname, workspace),
					consoleRoute ? Promise.resolve([]) : resolveCounters(workspace),
				]);

				const locale =
					payload?.locale ??
					(typeof config.locale === "function"
						? config.locale(url.pathname)
						: config.locale);
				const chatContext =
					typeof config.chatContext === "function"
						? config.chatContext(url.pathname)
						: config.chatContext;
				const html = renderToString(
					<Document
						lang={locale}
						seo={{
							...seoConfig,
							canonical: canonical(origin, url.pathname),
							ogImage: seoConfig.ogImage?.startsWith("/")
								? `${normalizeBaseUrl(origin)}${seoConfig.ogImage}`
								: seoConfig.ogImage,
						}}
						mount={chatContext ? { ...mount, chatContext } : mount}
						landing={payload}
						themeColor={config.themeColor}
						counters={counters}
					/>,
				);

				return new Response(await injectDelivery(`<!DOCTYPE html>${html}`), {
					headers: {
						"Content-Type": "text/html; charset=utf-8",
						"Cache-Control": "no-store",
					},
				});
			} catch (error) {
				console.error(
					`[ssr] render failed for ${url.pathname} (config: ${config.landingConfigPath(url.pathname)})`,
					error,
				);
				throw error;
			}
		});

		return app;
	};
}
