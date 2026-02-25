import { renderToString } from "react-dom/server";
import { resolve } from "path";
import createLandingPlugin from "front-ssr/plugin";
import type { SeoConfig } from "front-ssr/plugin";
import { AppSSR } from "./app/App";
import { Document } from "./app/Document";
import { appSitemapRoutes } from "./app/routes";
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

type RuntimeMfEnv = {
  "mf-docs": { docs: DocsInitItem[] };
  "mf-landing": { landingConfId: string; title?: string };
};

const DEFAULT_DOCS: DocsInitItem[] = [{ name: "club", id: "ru/club/index.json" }];
const DEFAULT_LANDING_CONF_ID = "ru/product/landing/4ir-laiding.json";

declare global {
  var __LANDING_SSR_DATA__: Record<string, LandingPrefetchPayload> | undefined;
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

export default function landingPlugin(config: { publicDir?: string; production?: boolean } = {}) {
  const landingRoot = resolve(import.meta.dir, "..");
  const mfEnv = buildRuntimeMfEnv();

  return createLandingPlugin({
    ...config,
    landingRoot,
    sitemapRoutes: appSitemapRoutes,
    buildStyles: async () => {
      const mod = await import("./ssr/styles");
      return mod.buildStyles();
    },
    loadSeoConfig,
    renderPage: async (
      url: string,
      importMap: Record<string, string>,
      seo: SeoConfig,
      baseUrl: string,
    ) => {
      const landingConfId = mfEnv["mf-landing"].landingConfId;
      let landingData: Record<string, LandingPrefetchPayload> = {};
      const isConsoleRoute = url === "/console" || url.startsWith("/console/");

      if (!isConsoleRoute) {
        try {
          const preloaded = await prefetchLandingPayload(landingConfId, baseUrl);
          landingData = { [landingConfId]: preloaded };
        } catch (error) {
          console.error("[landing] SSR prefetch failed", error);
        }
      }

      const previousSsrData = globalThis.__LANDING_SSR_DATA__;
      globalThis.__LANDING_SSR_DATA__ = landingData;

      try {
        const html = renderToString(
          <Document seo={seo} importMap={importMap} initialData={{ mfEnv, landing: landingData }}>
            <AppSSR url={url} />
          </Document>,
        );
        return `<!DOCTYPE html>${html}`;
      } finally {
        globalThis.__LANDING_SSR_DATA__ = previousSsrData;
      }
    },
  });
}
