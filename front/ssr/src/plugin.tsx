import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { resolve } from "path";
import { externalPackages, microfrontends } from "front-core/runtime-config";
import { createWorkspaceResolverPlugin } from "front-core/workspace-resolver";
import type { SitemapEntry } from "./ssr/sitemap";
import { buildSitemapXml } from "./ssr/sitemap";

export type { SitemapEntry };

export interface SeoConfig {
  title: string;
  description: string;
  keywords: string[];
  canonical?: string;
  ogImage?: string;
}

export interface LandingPluginConfig {
  /** Render full page HTML for given URL, import map and SEO config */
  renderPage: (
    url: string,
    importMap: Record<string, string>,
    seo: SeoConfig,
    baseUrl: string,
  ) => string | Promise<string>;
  /** Sitemap route entries */
  sitemapRoutes: SitemapEntry[];
  /** Build CSS styles (dev only, in prod uses prebuilt) */
  buildStyles: () => Promise<string>;
  /** Load SEO config from public dir */
  loadSeoConfig: (publicDir: string) => Promise<SeoConfig>;
  /** Landing root directory (where src/client.tsx lives) */
  landingRoot: string;
  /** Path to public dir */
  publicDir?: string;
  /** Force production mode */
  production?: boolean;
}

const fallbackBrowserImports: Record<string, string> = {
  "react": "/vendor/react.js",
  "react-dom": "/vendor/react-dom.js",
  "react-dom/client": "/vendor/react-dom-client.js",
  "react/jsx-runtime": "/vendor/react-jsx-runtime.js",
  "react/jsx-dev-runtime": "/vendor/react-jsx-dev-runtime.js",
  "react-router-dom": "/vendor/react-router-dom.js",
  "effector": "/vendor/effector.js",
  "effector-react": "/vendor/effector-react.js",
  "lucide-react": "/vendor/lucide-react.js",
  "dagre": "/vendor/dagre.js",
  "pixi.js": "/vendor/pixi.js",
  "recharts": "/vendor/recharts.js",
  "sonner": "/vendor/sonner.js",
  "effector/effector.mjs": "/vendor/effector.js",
  "front-core/components": "/front-core.js",
};

function buildBrowserImportMap(baseImports?: Record<string, string>): Record<string, string> {
  const fallbackEntries = Object.entries(fallbackBrowserImports).sort(
    (a, b) => b[0].length - a[0].length,
  );
  const resolveFallback = (specifier: string): string | null => {
    if (fallbackBrowserImports[specifier]) {
      return fallbackBrowserImports[specifier];
    }
    for (const [base, target] of fallbackEntries) {
      if (specifier.startsWith(`${base}/`)) {
        return target;
      }
    }
    return null;
  };

  const imports: Record<string, string> = {
    ...fallbackBrowserImports,
    ...(baseImports ?? {}),
  };

  for (const specifier of externalPackages) {
    if (imports[specifier]) continue;
    const resolved = resolveFallback(specifier);
    if (resolved) {
      imports[specifier] = resolved;
    }
  }

  imports["front-core"] = "/front-core.js";
  imports["front-core/components"] = "/front-core.js";
  for (const mf of microfrontends) {
    imports[mf] = `/mf/${mf}.js`;
  }
  return imports;
}

export default function createLandingPlugin(config: LandingPluginConfig) {
  const landingRoot = config.landingRoot;
  const projectRoot =
    process.env.PROJECT_DIR ??
    resolve(landingRoot, "..", "..");
  const parentProjectRoot =
    process.env.PARENT_PROJECT_DIR && process.env.PARENT_PROJECT_DIR.length > 0
      ? process.env.PARENT_PROJECT_DIR
      : undefined;
  const publicDir = config.publicDir ?? resolve(landingRoot, "public");
  const isProd = config.production ?? process.env.NODE_ENV === "production";
  const logoBlackPath = resolve(publicDir, "logo-black.svg");
  const logoWhitePath = resolve(publicDir, "logo-white.svg");
  const prebuiltStylesPath = resolve(projectRoot, "dist", "landing", "styles.css");
  const prebuiltClientPath = resolve(projectRoot, "dist", "landing", "client.js");
  const prebuiltFrontImportMapPath = resolve(projectRoot, "dist", "front", "import-map.json");

  let styles: string;
  let stylesBrotli: Uint8Array;
  let clientBundle: Blob;
  let clientBrotli: Uint8Array;
  let seoConfig: SeoConfig;
  let assetsPromise: Promise<void> | null = null;
  let browserImportMap: Record<string, string> = buildBrowserImportMap();

  const log = (message: string, extra?: Record<string, unknown>) => {
    if (extra) {
      console.log(`[landing] ${message}`, extra);
    } else {
      console.log(`[landing] ${message}`);
    }
  };

  const buildResolverPlugin = () =>
    createWorkspaceResolverPlugin(projectRoot, parentProjectRoot);

  function normalizeBaseUrl(value: string): string {
    return value.replace(/\/+$/, "");
  }

  function buildCanonical(baseUrl: string, path: string): string {
    const base = normalizeBaseUrl(baseUrl);
    if (path === "/" || path === "") return base;
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  async function ensureAssets(): Promise<void> {
    if (!assetsPromise) {
      assetsPromise = (async () => {
        const start = Date.now();
        log("ensureAssets:start");

        // Styles
        if (isProd) {
          const prebuiltStyles = Bun.file(prebuiltStylesPath);
          if (!(await prebuiltStyles.exists())) {
            throw new Error(`Missing prebuilt styles: ${prebuiltStylesPath}`);
          }
          styles = await prebuiltStyles.text();
          stylesBrotli = Bun.gzipSync(Buffer.from(styles), { level: 6 });
          log("styles:prebuilt", { bytes: styles.length });
        } else {
          styles = await config.buildStyles();
          log("styles:built", { ms: Date.now() - start });
        }

        // SEO
        seoConfig = await config.loadSeoConfig(publicDir);

        // Import map
        if (isProd) {
          const prebuiltImportMap = Bun.file(prebuiltFrontImportMapPath);
          if (!(await prebuiltImportMap.exists())) {
            throw new Error(`Missing prebuilt front import-map: ${prebuiltFrontImportMapPath}`);
          }
          const parsedImportMap = await prebuiltImportMap.json();
          browserImportMap = buildBrowserImportMap(
            parsedImportMap && typeof parsedImportMap === "object"
              ? (parsedImportMap as any).imports
              : undefined,
          );
        } else {
          browserImportMap = buildBrowserImportMap();
        }

        // Client bundle
        if (isProd) {
          const prebuiltClient = Bun.file(prebuiltClientPath);
          if (!(await prebuiltClient.exists())) {
            throw new Error(`Missing prebuilt client: ${prebuiltClientPath}`);
          }
          clientBundle = prebuiltClient;
          const bytes = await clientBundle.arrayBuffer();
          clientBrotli = Bun.gzipSync(Buffer.from(bytes), { level: 6 });
          log("client:prebuilt", { gzipKB: Number((clientBrotli.length / 1024).toFixed(0)) });
        } else {
          const clientResult = await Bun.build({
            entrypoints: [resolve(landingRoot, "src/client.tsx")],
            format: "esm",
            minify: false,
            external: [...externalPackages, ...microfrontends],
            plugins: [buildResolverPlugin()],
          });
          if (!clientResult.success || clientResult.outputs.length === 0) {
            const errors = clientResult.logs.map((l) => l.message).join("\n");
            throw new Error("client build failed:\n" + errors);
          }
          clientBundle = clientResult.outputs[0];
          log("client:built", { kb: Number((clientBundle.size / 1024).toFixed(0)) });
        }

        log("ensureAssets:done", { ms: Date.now() - start });
      })();
    }
    await assetsPromise;
  }

  async function renderPage(url: string, baseUrl: string): Promise<string> {
    await ensureAssets();
    const canonical = buildCanonical(baseUrl, url);
    const ogImage =
      seoConfig.ogImage && seoConfig.ogImage.startsWith("/")
        ? `${normalizeBaseUrl(baseUrl)}${seoConfig.ogImage}`
        : seoConfig.ogImage;
    return await config.renderPage(url, browserImportMap, {
      ...seoConfig,
      canonical,
      ogImage,
    }, baseUrl);
  }

  function supportsEncoding(request: Request, encoding: string): boolean {
    const accept = request.headers.get("accept-encoding") || "";
    return accept.includes(encoding);
  }

  const app = new Elysia({ name: "landing" })
    .onStart(async () => {
      log("onStart");
      if (isProd) {
        await ensureAssets();
      }
    })
    .get("/styles.css", async ({ request }) => {
      await ensureAssets();
      if (isProd && supportsEncoding(request, "gzip")) {
        return new Response(stylesBrotli, {
          headers: {
            "Content-Type": "text/css; charset=utf-8",
            "Content-Encoding": "gzip",
          },
        });
      }
      return new Response(styles, {
        headers: { "Content-Type": "text/css; charset=utf-8" },
      });
    })
    .get("/client.js", async ({ request }) => {
      await ensureAssets();
      if (isProd && supportsEncoding(request, "gzip")) {
        return new Response(clientBrotli, {
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Content-Encoding": "gzip",
            "Cache-Control": "no-store",
          },
        });
      }
      return new Response(clientBundle, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    })
    .get("/logo-black.svg", () => {
      return new Response(Bun.file(logoBlackPath), {
        headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
      });
    })
    .get("/logo-white.svg", () => {
      return new Response(Bun.file(logoWhitePath), {
        headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
      });
    })
    .get("/sitemap.xml", ({ request }) => {
      const origin =
        isProd && seoConfig?.canonical
          ? normalizeBaseUrl(seoConfig.canonical)
          : new URL(request.url).origin;
      return new Response(buildSitemapXml(origin, config.sitemapRoutes), {
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    })
    .get("/robots.txt", ({ request }) => {
      const origin =
        isProd && seoConfig?.canonical
          ? normalizeBaseUrl(seoConfig.canonical)
          : new URL(request.url).origin;
      const body = [
        "User-agent: *",
        "Allow: /",
        `Sitemap: ${origin}/sitemap.xml`,
      ].join("\n");
      return new Response(body, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    })
    .use(staticPlugin({ assets: publicDir, prefix: "/" }));

  app.get("/*", async ({ request }) => {
    const url = new URL(request.url);
    const baseUrl =
      isProd && seoConfig?.canonical
        ? normalizeBaseUrl(seoConfig.canonical)
        : url.origin;
    const html = await renderPage(url.pathname, baseUrl);
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

  return app;
}
