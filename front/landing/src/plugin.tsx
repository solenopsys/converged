import { renderToReadableStream } from "react-dom/server";
import { resolve } from "path";
import { createMarkdownServiceClient } from "g-markdown";
import createLandingPlugin from "front-ssr/plugin";
import type { SeoConfig } from "front-ssr/plugin";
import { AppSSR } from "./app/App";
import { Document } from "./app/Document";
import { appSitemapRoutes } from "./app/routes";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  buildLocalePath,
  extractLocaleFromPath,
  isSupportedLocale,
  type SupportedLocale,
} from "./app/i18n";
import { loadSeoConfig } from "./ssr/seo";

type DocsInitItem = { name: string; id: string };
type LandingBlockConfig = {
  id?: string;
  type: string;
  sources?: Record<string, string>;
  props?: Record<string, unknown>;
};
type LandingConfig = {
  id?: string;
  title?: string;
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

const LANDING_CONF_SUFFIX = "product/landing/4ir-laiding.json";
const DOCS_INDEX_SUFFIX = "club/index.json";
const DEFAULT_DOCS: DocsInitItem[] = [{ name: "club", id: `${DEFAULT_LOCALE}/${DOCS_INDEX_SUFFIX}` }];
const DEFAULT_LANDING_CONF_ID = `${DEFAULT_LOCALE}/${LANDING_CONF_SUFFIX}`;

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
      const name = typeof (item as any).name === "string" ? (item as any).name.trim() : "";
      const id = typeof (item as any).id === "string" ? (item as any).id.trim() : "";
      if (!id) return null;
      return { name: name || "docs", id };
    })
    .filter((item): item is DocsInitItem => item !== null);

  return normalized.length > 0 ? normalized : DEFAULT_DOCS;
}

function normalizeLanding(value: unknown): { landingConfId: string; title?: string } {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const fallbackId =
    typeof process.env.MF_LANDING_CONF_ID === "string" && process.env.MF_LANDING_CONF_ID.trim().length > 0
      ? process.env.MF_LANDING_CONF_ID.trim()
      : DEFAULT_LANDING_CONF_ID;

  const landingConfId =
    typeof record.landingConfId === "string" && record.landingConfId.trim().length > 0
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

function localizeDocsConfig(docs: DocsInitItem[], locale: SupportedLocale): DocsInitItem[] {
  return docs.map((item) => ({
    ...item,
    id: withLocalePrefix(item.id, locale),
  }));
}

function resolveDocPath(slug: string, locale: SupportedLocale): string {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return `${locale}/club/intro.md`;
  if (normalizedSlug === "club") return `${locale}/club/intro.md`;
  if (normalizedSlug.includes("/")) return withLocalePrefix(normalizedSlug, locale);
  return `${locale}/${normalizedSlug}.md`;
}

async function structCall<T>(
  servicesBaseUrl: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${servicesBaseUrl}/struct/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`struct/${method} failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function prefetchLandingPayload(
  configPath: string,
  baseUrl: string,
): Promise<LandingPrefetchPayload> {
  const servicesBaseUrl = `${normalizeBaseUrl(baseUrl)}/services`;
  const config = await structCall<LandingConfig>(servicesBaseUrl, "readJson", {
    path: configPath,
  });

  const blocks = Array.isArray(config?.blocks) ? config.blocks : [];
  const sourcePaths = Array.from(
    new Set(
      blocks.flatMap((block) =>
        Object.values(block.sources ?? {}).filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        ),
      ),
    ),
  );

  const sourceValues = sourcePaths.length > 0
    ? await structCall<any[]>(servicesBaseUrl, "readJsonBatch", {
        paths: sourcePaths,
      })
    : [];

  const sourceMap = new Map<string, unknown>();
  sourcePaths.forEach((path, index) => {
    sourceMap.set(path, Array.isArray(sourceValues) ? sourceValues[index] : undefined);
  });

  const resolvedBlocks: ResolvedBlock[] = blocks.map((block, index) => {
    const data: Record<string, unknown> = {};
    for (const [alias, sourcePath] of Object.entries(block.sources ?? {})) {
      data[alias] = sourceMap.get(sourcePath);
    }

    return {
      id: block.id || `${block.type}-${index}`,
      type: block.type,
      props: block.props ?? {},
      data,
    };
  });

  return { configPath, blocks: resolvedBlocks };
}

async function prefetchDocsPayload(
  slug: string,
  baseUrl: string,
  locale: SupportedLocale,
): Promise<DocsPrefetchPayload> {
  const servicesBaseUrl = `${normalizeBaseUrl(baseUrl)}/services`;
  const markdownClient = createMarkdownServiceClient({ baseUrl: servicesBaseUrl });
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

export default function landingPlugin(config: { publicDir?: string; production?: boolean } = {}) {
  const landingRoot = resolve(import.meta.dir, "..");
  const mfEnv = buildRuntimeMfEnv();
  const localePrefixes = SUPPORTED_LOCALES.map((locale) => `/${locale}`);

  function resolveRedirectPath(pathname: string): string | null {
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
    sitemapRoutes: appSitemapRoutes,
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
    ) => {
      const locale = extractLocaleFromPath(url) ?? DEFAULT_LOCALE;
      const localizedDocs = localizeDocsConfig(mfEnv["mf-docs"].docs, locale);
      const landingConfId = withLocalePrefix(mfEnv["mf-landing"].landingConfId, locale);
      const localizedMfEnv: RuntimeMfEnv = {
        "mf-docs": { docs: localizedDocs },
        "mf-landing": { ...mfEnv["mf-landing"], landingConfId },
      };
      let landingData: Record<string, LandingPrefetchPayload> = {};
      let docsData: Record<string, DocsPrefetchPayload> = {};
      const routePath = stripLocalePrefix(url);
      const isConsoleRoute = routePath === "/console" || routePath.startsWith("/console/");

      if (!isConsoleRoute) {
        try {
          const preloaded = await prefetchLandingPayload(landingConfId, baseUrl);
          landingData = { [landingConfId]: preloaded };
        } catch (error) {
          console.error("[landing] SSR prefetch failed", error);
        }
      }

      if (!isConsoleRoute && routePath.startsWith("/docs/")) {
        const slug = routePath.slice("/docs/".length).split("/").filter(Boolean)[0] ?? "";
        if (slug) {
          try {
            const preloaded = await prefetchDocsPayload(slug, baseUrl, locale);
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
            initialData={{ mfEnv: localizedMfEnv, landing: landingData, docs: docsData }}
          >
            <AppSSR url={url} />
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
