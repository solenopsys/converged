import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { resolve } from "path";
import { existsSync } from "fs";
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
  /**
   * Override the list of microfrontend names to include in the browser import map.
   * Use this when the plugin is loaded before PROJECT_DIR is set correctly,
   * so that runtime-config.ts may have cached a stale microfrontend list.
   */
  microfrontends?: string[];
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

const defaultServiceWorkerScript = [
  "self.addEventListener('install', () => self.skipWaiting());",
  "self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));",
].join("\n");

const pwaRegistrationScript = [
  "(() => {",
  "  if (!('serviceWorker' in navigator)) return;",
  "  const register = () => navigator.serviceWorker.register('/sw.js').catch((error) => {",
  "    console.warn('[pwa] service worker registration failed', error);",
  "  });",
  "  if (document.readyState === 'complete') register();",
  "  else window.addEventListener('load', register, { once: true });",
  "})();",
].join("");

function buildBrowserImportMap(
  baseImports?: Record<string, string>,
  mfOverride?: string[],
): Record<string, string> {
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
  const mfList = (mfOverride && mfOverride.length > 0) ? mfOverride : microfrontends;
  for (const mf of mfList) {
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
  const enablePwaInDev =
    process.env.PWA_DEV === "1" ||
    process.env.PWA_DEV === "true";
  const pwaEnabled = isProd || enablePwaInDev;
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
  let browserImportMap: Record<string, string> = buildBrowserImportMap(undefined, config.microfrontends);

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

  function buildDefaultManifest(baseUrl: string) {
    const appName = seoConfig?.title?.trim() || "4IR App";
    const appShortName = appName.length > 16 ? appName.slice(0, 16).trim() : appName;
    const fallbackIcon = existsSync(resolve(publicDir, "favicon.svg")) ? "/favicon.svg" : "/logo-black.svg";
    return {
      name: appName,
      short_name: appShortName || "4IR",
      description: seoConfig?.description || appName,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#000000",
      icons: [
        {
          src: fallbackIcon,
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any",
        },
      ],
      id: normalizeBaseUrl(baseUrl),
    };
  }

  function injectPwaRegistration(html: string): string {
    if (!pwaEnabled) return html;
    if (html.includes("data-pwa-bootstrap")) return html;
    const snippet = `<script data-pwa-bootstrap>${pwaRegistrationScript}</script>`;
    if (html.includes("</body>")) {
      return html.replace("</body>", `${snippet}</body>`);
    }
    return `${html}${snippet}`;
  }

  function injectManifestLink(html: string): string {
    if (!pwaEnabled) return html;
    if (/\brel=["']manifest["']/i.test(html)) return html;
    const snippet = `<link rel="manifest" href="/manifest.json" />`;
    if (html.includes("</head>")) {
      return html.replace("</head>", `${snippet}</head>`);
    }
    return `${snippet}${html}`;
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
            config.microfrontends,
          );
        } else {
          browserImportMap = buildBrowserImportMap(undefined, config.microfrontends);
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
    const rendered = await config.renderPage(url, browserImportMap, {
      ...seoConfig,
      canonical,
      ogImage,
    }, baseUrl);
    return injectPwaRegistration(injectManifestLink(rendered));
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
    .get("/manifest.json", ({ request }) => {
      const manifestPath = resolve(publicDir, "manifest.json");
      if (existsSync(manifestPath)) {
        return new Response(Bun.file(manifestPath), {
          headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
        });
      }
      const baseUrl =
        isProd && seoConfig?.canonical
          ? normalizeBaseUrl(seoConfig.canonical)
          : new URL(request.url).origin;
      return new Response(JSON.stringify(buildDefaultManifest(baseUrl), null, 2), {
        headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
      });
    })
    .get("/sw.js", () => {
      const serviceWorkerPath = resolve(publicDir, "sw.js");
      if (existsSync(serviceWorkerPath)) {
        return new Response(Bun.file(serviceWorkerPath), {
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      return new Response(defaultServiceWorkerScript, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
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
