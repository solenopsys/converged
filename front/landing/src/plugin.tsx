import { buildWorkspaceHeaders } from "front-core/workspace-domain";
import type { SeoConfig } from "front-ssr/plugin";
import createLandingPlugin from "front-ssr/plugin";
import { createMarkdownServiceClient } from "g-markdown";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { renderToReadableStream } from "react-dom/server";
import { AppSSR } from "./app/App";
import { Document } from "./app/Document";
import {
	buildLocalePath,
	DEFAULT_LOCALE,
	extractLocaleFromPath,
	isSupportedLocale,
	SUPPORTED_LOCALES,
	type SupportedLocale,
} from "./app/i18n";
import type { LocaleRoutingConfig } from "./app/locale-routing";
import { appSitemapRoutes } from "./app/routes";
import { loadSeoConfig } from "./ssr/seo";

type DocsInitItem = { name: string; id: string };
type LandingBlockConfig = {
	id?: string;
	type: string;
	sources?: Record<string, string>;
	props?: Record<string, unknown>;
};
type LandingMenuLinkConfig = {
	blockId?: string;
	href?: string;
	label?: string;
	sectionId?: string;
	targetId?: string;
};
type LandingMenuLink = {
	href: string;
	label: string;
};
type LandingNavigationConfig = {
	menuLinks?: LandingMenuLinkConfig[];
};
type ResolvedLandingNavigation = {
	menuLinks?: LandingMenuLink[];
};
type LandingConfig = {
	id?: string;
	title?: string;
	navigation?: LandingNavigationConfig;
	blocks?: LandingBlockConfig[];
};
type ResolvedBlock = {
	id: string;
	type: string;
	props: Record<string, unknown>;
	data: Record<string, unknown>;
};
type LandingPrefetchPayload = {
	configPath: string;
	navigation?: ResolvedLandingNavigation;
	blocks: ResolvedBlock[];
};

type DocsPrefetchPayload = {
	slug: string;
	markdownPath: string;
	ast: unknown | null;
	error?: string;
};

type RuntimeMfEnv = {
	"mf-docs": { docs: DocsInitItem[] };
	"mf-landing": { landingConfId: string; title?: string };
};
type ProjectConfig = {
	localization?: {
		mode?: string;
		locale?: string;
		language?: string;
	};
	i18n?: {
		mode?: string;
		locale?: string;
		language?: string;
	};
};

const LANDING_CONF_SUFFIX = "product/landing/cnc-landing.json";
const DOCS_INDEX_SUFFIX = "product/docs/index.json";
const DEFAULT_DOCS: DocsInitItem[] = [
	{ name: "cnc", id: `${DEFAULT_LOCALE}/${DOCS_INDEX_SUFFIX}` },
];
const DEFAULT_LANDING_CONF_ID = `${DEFAULT_LOCALE}/${LANDING_CONF_SUFFIX}`;

function readProjectConfig(): ProjectConfig {
	const configPath =
		process.env.CONFIG_PATH ||
		(process.env.PROJECT_DIR ? resolve(process.env.PROJECT_DIR, "config.json") : "");
	if (!configPath || !existsSync(configPath)) return {};
	try {
		return JSON.parse(readFileSync(configPath, "utf8")) as ProjectConfig;
	} catch (error) {
		console.warn("[landing] failed to read project config", error);
		return {};
	}
}

function resolveLocaleRouting(config: ProjectConfig): LocaleRoutingConfig {
	const raw = config.localization ?? config.i18n ?? {};
	const localeRaw = raw.locale ?? raw.language;
	const locale = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
	return {
		mode: raw.mode === "single" ? "single" : "multi",
		locale,
	};
}

function resolveLandingMenuLinks(
	value: unknown,
	blocks: ResolvedBlock[],
): LandingMenuLink[] {
	if (!Array.isArray(value)) return [];
	const blockById = new Map(blocks.map((block) => [block.id, block]));

	return value.flatMap((item): LandingMenuLink[] => {
		if (!item || typeof item !== "object") return [];
		const record = item as Record<string, unknown>;
		const explicitHref =
			typeof record.href === "string" ? record.href.trim() : "";
		const targetId =
			typeof record.blockId === "string" && record.blockId.trim()
				? record.blockId.trim()
				: typeof record.sectionId === "string" && record.sectionId.trim()
					? record.sectionId.trim()
					: typeof record.targetId === "string" && record.targetId.trim()
						? record.targetId.trim()
						: "";
		const href =
			explicitHref ||
			(targetId && blockById.has(targetId)
				? `#${targetId.replace(/^#/, "")}`
				: "");
		const label =
			typeof record.label === "string" && record.label.trim()
				? record.label.trim()
				: targetId
					? resolveBlockNavLabel(blockById.get(targetId))
					: "";

		return label && href ? [{ label, href }] : [];
	});
}

function readString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function readNestedString(value: unknown, key: string): string {
	if (!value || typeof value !== "object") return "";
	return readString((value as Record<string, unknown>)[key]);
}

function resolveBlockNavLabel(block: ResolvedBlock | undefined): string {
	if (!block) return "";

	const explicit = readString(block.props.navLabel);
	if (explicit) return explicit;

	for (const source of Object.values(block.data)) {
		const navLabel = readNestedString(source, "navLabel");
		if (navLabel) return navLabel;
		const title = readNestedString(source, "title");
		if (title) return title;
		const railLabel = readNestedString(source, "railLabel");
		if (railLabel) return railLabel;
		const headline = readNestedString(source, "headline");
		if (headline) return headline;
	}

	return "";
}

function resolveLandingNavigation(
	navigation: LandingNavigationConfig | undefined,
	blocks: ResolvedBlock[],
): ResolvedLandingNavigation | undefined {
	const menuLinks = resolveLandingMenuLinks(navigation?.menuLinks, blocks);
	return menuLinks.length > 0 ? { menuLinks } : undefined;
}

declare global {
	var __LANDING_SSR_DATA__: Record<string, LandingPrefetchPayload> | undefined;
	var __DOCS_SSR_DATA__: Record<string, DocsPrefetchPayload> | undefined;
}

function parseJson(raw: string | undefined): unknown {
	if (!raw || raw.trim().length === 0) return undefined;
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

function normalizeDocs(value: unknown): DocsInitItem[] {
	const list = Array.isArray(value)
		? value
		: value && typeof value === "object" && Array.isArray((value as any).docs)
			? (value as any).docs
			: [];

	const normalized = list
		.map((item) => {
			if (!item || typeof item !== "object") return null;
			const name =
				typeof (item as any).name === "string" ? (item as any).name.trim() : "";
			const id =
				typeof (item as any).id === "string" ? (item as any).id.trim() : "";
			if (!id) return null;
			return { name: name || "docs", id };
		})
		.filter((item): item is DocsInitItem => item !== null);

	return normalized.length > 0 ? normalized : DEFAULT_DOCS;
}

function normalizeLanding(value: unknown): {
	landingConfId: string;
	title?: string;
} {
	const record =
		value && typeof value === "object"
			? (value as Record<string, unknown>)
			: {};

	const fallbackId =
		typeof process.env.MF_LANDING_CONF_ID === "string" &&
		process.env.MF_LANDING_CONF_ID.trim().length > 0
			? process.env.MF_LANDING_CONF_ID.trim()
			: DEFAULT_LANDING_CONF_ID;

	const landingConfId =
		typeof record.landingConfId === "string" &&
		record.landingConfId.trim().length > 0
			? record.landingConfId.trim()
			: fallbackId;

	const title =
		typeof record.title === "string" && record.title.trim().length > 0
			? record.title.trim()
			: undefined;

	return { landingConfId, ...(title ? { title } : {}) };
}

function buildRuntimeMfEnv(): RuntimeMfEnv {
	const docsRaw = parseJson(process.env.MF_DOCS_INIT);
	const landingRaw = parseJson(process.env.MF_LANDING_INIT);

	return {
		"mf-docs": {
			docs: normalizeDocs(docsRaw),
		},
		"mf-landing": normalizeLanding(landingRaw),
	};
}

function normalizeBaseUrl(value: string): string {
	return value.replace(/\/+$/, "");
}

function stripLocalePrefix(path: string): string {
	const locale = extractLocaleFromPath(path);
	if (!locale) return path;
	const rest = path.slice(locale.length + 1);
	return rest.length > 0 ? rest : "/";
}

function stripAnyLocalePrefix(path: string): string | null {
	const locale = extractLocaleFromPath(path);
	if (!locale) return null;
	const rest = path.slice(locale.length + 1);
	return rest.length > 0 ? rest : "/";
}

function extractRequestId(path: string): string | null {
	const routePath = stripLocalePrefix(path);
	const match = routePath.match(/^\/request\/([^/?#]+)/);
	return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function withLocalePrefix(path: string, locale: SupportedLocale): string {
	const normalized = path.trim().replace(/^\/+/, "");
	if (!normalized) return `${locale}/`;
	const segments = normalized.split("/");
	if (isSupportedLocale(segments[0])) {
		segments[0] = locale;
		return segments.join("/");
	}
	return `${locale}/${normalized}`;
}

function localizeDocsConfig(
	docs: DocsInitItem[],
	locale: SupportedLocale,
): DocsInitItem[] {
	return docs.map((item) => ({
		...item,
		id: withLocalePrefix(item.id, locale),
	}));
}

function resolveDocPath(slug: string, locale: SupportedLocale): string {
	const normalizedSlug = slug.trim();
	if (!normalizedSlug) return `${locale}/product/docs/intro.md`;
	if (normalizedSlug === "cnc") return `${locale}/product/docs/intro.md`;
	if (normalizedSlug.includes("/"))
		return withLocalePrefix(normalizedSlug, locale);
	return `${locale}/${normalizedSlug}.md`;
}

async function structCall<T>(
	servicesBaseUrl: string,
	method: string,
	payload: Record<string, unknown>,
	workspace?: string,
): Promise<T> {
	const response = await fetch(`${servicesBaseUrl}/struct/${method}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...buildWorkspaceHeaders(workspace),
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(
			`struct/${method} failed: ${response.status} ${response.statusText}`,
		);
	}

	return response.json() as Promise<T>;
}

async function prefetchLandingPayload(
	configPath: string,
	baseUrl: string,
	workspace?: string,
): Promise<LandingPrefetchPayload> {
	const servicesBaseUrl = `${normalizeBaseUrl(baseUrl)}/services`;
	const config = await structCall<LandingConfig>(
		servicesBaseUrl,
		"readJson",
		{
			path: configPath,
		},
		workspace,
	);

	const locale = configPath.split("/")[0] ?? "";

	function localizeSourcePath(p: string): string {
		if (!locale || p.startsWith(`${locale}/`)) return p;
		return `${locale}/${p}`;
	}

	const blocks = Array.isArray(config?.blocks) ? config.blocks : [];
	const rawSourcePaths = Array.from(
		new Set(
			blocks.flatMap((block) =>
				Object.values(block.sources ?? {}).filter(
					(value): value is string =>
						typeof value === "string" && value.trim().length > 0,
				),
			),
		),
	);
	const sourcePaths = rawSourcePaths.map(localizeSourcePath);

	const sourceValues =
		sourcePaths.length > 0
			? await structCall<any[]>(
					servicesBaseUrl,
					"readJsonBatch",
					{
						paths: sourcePaths,
					},
					workspace,
				)
			: [];

	const sourceMap = new Map<string, unknown>();
	sourcePaths.forEach((path, index) => {
		sourceMap.set(
			path,
			Array.isArray(sourceValues) ? sourceValues[index] : undefined,
		);
	});

	const resolvedBlocks: ResolvedBlock[] = blocks.map((block, index) => {
		const data: Record<string, unknown> = {};
		for (const [alias, sourcePath] of Object.entries(block.sources ?? {})) {
			data[alias] = sourceMap.get(localizeSourcePath(sourcePath));
		}

		return {
			id: block.id || `${block.type}-${index}`,
			type: block.type,
			props: block.props ?? {},
			data,
		};
	});

	return {
		configPath,
		navigation: resolveLandingNavigation(config.navigation, resolvedBlocks),
		blocks: resolvedBlocks,
	};
}

async function prefetchDocsPayload(
	slug: string,
	baseUrl: string,
	locale: SupportedLocale,
	workspace?: string,
): Promise<DocsPrefetchPayload> {
	const servicesBaseUrl = `${normalizeBaseUrl(baseUrl)}/services`;
	const markdownClient = createMarkdownServiceClient({
		baseUrl: servicesBaseUrl,
		workspace,
	});
	const markdownPath = resolveDocPath(slug, locale);

	try {
		const result = await markdownClient.readMdJson(markdownPath);
		return {
			slug,
			markdownPath,
			ast: result?.content ?? null,
		};
	} catch (error) {
		return {
			slug,
			markdownPath,
			ast: null,
			error: error instanceof Error ? error.message : "Failed to load document",
		};
	}
}

export default function landingPlugin(
	config: { publicDir?: string; production?: boolean } = {},
) {
	const landingRoot = resolve(import.meta.dir, "..");
	const localeRouting = resolveLocaleRouting(readProjectConfig());
	const mfEnv = buildRuntimeMfEnv();
	const localePrefixes = SUPPORTED_LOCALES.map((locale) => `/${locale}`);

	function resolveRedirectPath(pathname: string): string | null {
		if (localeRouting.mode === "single") {
			const stripped = stripAnyLocalePrefix(pathname);
			return stripped && stripped !== pathname ? stripped : null;
		}

		if (pathname === "/") {
			return buildLocalePath(DEFAULT_LOCALE, "/");
		}

		for (const prefix of localePrefixes) {
			if (pathname === prefix) {
				return `${prefix}/`;
			}
			if (pathname.startsWith(`${prefix}/`)) {
				return null;
			}
		}

		if (
			pathname.startsWith("/console") ||
			pathname.startsWith("/services") ||
			pathname.startsWith("/mf/") ||
			pathname.startsWith("/locales/") ||
			pathname.startsWith("/libraries/") ||
			pathname === "/sitemap.xml" ||
			pathname === "/robots.txt" ||
			pathname === "/manifest.json" ||
			pathname === "/sw.js"
		) {
			return null;
		}

		if (/\.[a-z0-9]+$/i.test(pathname)) {
			return null;
		}

		return buildLocalePath(DEFAULT_LOCALE, pathname);
	}

	return createLandingPlugin({
		...config,
		landingRoot,
		sitemapRoutes:
			localeRouting.mode === "single"
				? [{ path: "/", changefreq: "weekly", priority: 1 }]
				: appSitemapRoutes,
		resolveRedirectPath,
		buildStyles: async () => {
			const mod = await import("./ssr/styles");
			return mod.buildStyles();
		},
		buildSpaStyles: async () => {
			const mod = await import("./ssr/styles");
			return mod.buildSpaStyles();
		},
		loadSeoConfig,
		renderPage: async (
			url: string,
			importMap: Record<string, string>,
			seo: SeoConfig,
			baseUrl: string,
			workspace?: string,
		) => {
			const locale =
				localeRouting.mode === "single"
					? localeRouting.locale
					: extractLocaleFromPath(url) ?? DEFAULT_LOCALE;
			const localizedDocs = localizeDocsConfig(mfEnv["mf-docs"].docs, locale);
			const landingConfId = withLocalePrefix(
				mfEnv["mf-landing"].landingConfId,
				locale,
			);
			const localizedMfEnv: RuntimeMfEnv = {
				"mf-docs": { docs: localizedDocs },
				"mf-landing": { ...mfEnv["mf-landing"], landingConfId },
			};
			let landingData: Record<string, LandingPrefetchPayload> = {};
			let docsData: Record<string, DocsPrefetchPayload> = {};
			const routePath = stripLocalePrefix(url);
			const requestId = extractRequestId(url);
			const isConsoleRoute =
				routePath === "/console" || routePath.startsWith("/console/");

			if (!isConsoleRoute && !requestId) {
				try {
					const preloaded = await prefetchLandingPayload(
						landingConfId,
						baseUrl,
						workspace,
					);
					landingData = { [landingConfId]: preloaded };
				} catch (error) {
					console.error("[landing] SSR prefetch failed", error);
				}
			}

			if (!isConsoleRoute && routePath.startsWith("/docs/")) {
				const slug =
					routePath.slice("/docs/".length).split("/").filter(Boolean)[0] ?? "";
				if (slug) {
					try {
						const preloaded = await prefetchDocsPayload(
							slug,
							baseUrl,
							locale,
							workspace,
						);
						docsData = { [slug]: preloaded };
					} catch (error) {
						console.error("[landing] SSR docs prefetch failed", error);
					}
				}
			}

			const previousSsrData = globalThis.__LANDING_SSR_DATA__;
			const previousDocsSsrData = globalThis.__DOCS_SSR_DATA__;
			globalThis.__LANDING_SSR_DATA__ = landingData;
			globalThis.__DOCS_SSR_DATA__ = docsData;

			try {
				const stream = await renderToReadableStream(
					<Document
						lang={locale}
						seo={seo}
						importMap={importMap}
						initialData={{
							mfEnv: localizedMfEnv,
							landing: landingData,
							docs: docsData,
							workspace,
							localization: localeRouting,
						}}
					>
						<AppSSR url={url} localeRouting={localeRouting} />
					</Document>,
				);
				await stream.allReady;
				const reader = stream.getReader();
				const chunks: Uint8Array[] = [];
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (value) chunks.push(value);
				}
				const body = Buffer.concat(chunks).toString("utf-8");
				return `<!DOCTYPE html>${body}`;
			} finally {
				globalThis.__LANDING_SSR_DATA__ = previousSsrData;
				globalThis.__DOCS_SSR_DATA__ = previousDocsSsrData;
			}
		},
	});
}
