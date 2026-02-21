import { Elysia } from "elysia";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { externalPackages, microfrontends } from "front-core/runtime-config";
import { createWorkspaceResolverPlugin } from "front-core/workspace-resolver";

export interface SpaPluginConfig {
  production?: boolean;
}

// fileName → npm specifier
const vendorEntries: Record<string, string> = {
  "react.js": "react",
  "react-dom.js": "react-dom",
  "react-dom-client.js": "react-dom/client",
  "react-jsx-runtime.js": "react/jsx-runtime",
  "react-jsx-dev-runtime.js": "react/jsx-dev-runtime",
  "react-router-dom.js": "react-router-dom",
  "effector.js": "effector",
  "effector-react.js": "effector-react",
  "lucide-react.js": "lucide-react",
  "dagre.js": "dagre",
  "pixi.js": "pixi.js",
  "recharts.js": "recharts",
  "sonner.js": "sonner",
};

const sharedExternals = Object.values(vendorEntries);

function buildVendorWrapper(specifier: string, source: string): string {
  // react: CJS-ish shape in Bun build; keep explicit named exports
  // so browser import map consumers can import stable symbols.
  if (specifier === "react") {
    return [
      `import * as mod from "${source}";`,
      "const m = (mod as any).default ?? mod;",
      "export const Activity = m.Activity;",
      "export const Children = m.Children;",
      "export const Component = m.Component;",
      "export const Fragment = m.Fragment;",
      "export const Profiler = m.Profiler;",
      "export const PureComponent = m.PureComponent;",
      "export const StrictMode = m.StrictMode;",
      "export const Suspense = m.Suspense;",
      "export const __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = m.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;",
      "export const __COMPILER_RUNTIME = m.__COMPILER_RUNTIME;",
      "export const act = m.act;",
      "export const cache = m.cache;",
      "export const cacheSignal = m.cacheSignal;",
      "export const captureOwnerStack = m.captureOwnerStack;",
      "export const cloneElement = m.cloneElement;",
      "export const createContext = m.createContext;",
      "export const createElement = m.createElement;",
      "export const createRef = m.createRef;",
      "export const forwardRef = m.forwardRef;",
      "export const isValidElement = m.isValidElement;",
      "export const lazy = m.lazy;",
      "export const memo = m.memo;",
      "export const startTransition = m.startTransition;",
      "export const unstable_useCacheRefresh = m.unstable_useCacheRefresh;",
      "export const use = m.use;",
      "export const useActionState = m.useActionState;",
      "export const useCallback = m.useCallback;",
      "export const useContext = m.useContext;",
      "export const useDebugValue = m.useDebugValue;",
      "export const useDeferredValue = m.useDeferredValue;",
      "export const useEffect = m.useEffect;",
      "export const useEffectEvent = m.useEffectEvent;",
      "export const useId = m.useId;",
      "export const useImperativeHandle = m.useImperativeHandle;",
      "export const useInsertionEffect = m.useInsertionEffect;",
      "export const useLayoutEffect = m.useLayoutEffect;",
      "export const useMemo = m.useMemo;",
      "export const useOptimistic = m.useOptimistic;",
      "export const useReducer = m.useReducer;",
      "export const useRef = m.useRef;",
      "export const useState = m.useState;",
      "export const useSyncExternalStore = m.useSyncExternalStore;",
      "export const useTransition = m.useTransition;",
      "export const version = m.version;",
      "export default m;",
    ].join("\n");
  }

  // react-dom: CJS — explicit named exports
  if (specifier === "react-dom") {
    return [
      `import * as mod from "${source}";`,
      "const m = (mod as any).default ?? mod;",
      "export const createPortal = m.createPortal;",
      "export const flushSync = m.flushSync;",
      "export const preconnect = m.preconnect;",
      "export const prefetchDNS = m.prefetchDNS;",
      "export const preinit = m.preinit;",
      "export const preinitModule = m.preinitModule;",
      "export const preload = m.preload;",
      "export const preloadModule = m.preloadModule;",
      "export const requestFormReset = m.requestFormReset;",
      "export const unstable_batchedUpdates = m.unstable_batchedUpdates;",
      "export const useFormState = m.useFormState;",
      "export const useFormStatus = m.useFormStatus;",
      "export const version = m.version;",
      "export const __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = m.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;",
      "export default m;",
    ].join("\n");
  }
  // react-dom/client: CJS subpath
  if (specifier === "react-dom/client") {
    return [
      `import * as mod from "${source}";`,
      "const m = (mod as any).default ?? mod;",
      "export const createRoot = m.createRoot;",
      "export const hydrateRoot = m.hydrateRoot;",
      "export const version = m.version;",
      "export default m;",
    ].join("\n");
  }
  // jsx runtimes: CJS
  if (specifier === "react/jsx-runtime" || specifier === "react/jsx-dev-runtime") {
    return [
      `import * as mod from "${source}";`,
      "export const jsx = mod.jsx;",
      "export const jsxs = mod.jsxs;",
      "export const jsxDEV = (mod as any).jsxDEV;",
      "export const Fragment = mod.Fragment;",
      "export default mod;",
    ].join("\n");
  }
  // generic: works for both ESM and CJS (Bun.build resolves CJS named exports via __reExport)
  return [
    `import * as mod from "${source}";`,
    `export * from "${source}";`,
    "export default (mod as any).default ?? mod;",
  ].join("\n");
}

export default function spaPlugin(config: SpaPluginConfig = {}) {
  const projectRoot = process.env.PROJECT_DIR ?? resolve(import.meta.dir, "..", "..", "..");
  const parentProjectRoot =
    process.env.PARENT_PROJECT_DIR && process.env.PARENT_PROJECT_DIR.length > 0
      ? process.env.PARENT_PROJECT_DIR
      : undefined;
  const isProd = config.production ?? process.env.NODE_ENV === "production";
  const frontRoot = resolve(projectRoot, "front");
  const brandingProjectRoot = parentProjectRoot ?? projectRoot;
  const brandingPublicDir = resolve(brandingProjectRoot, "front", "landing", "public");
  const logoBlackPath = resolve(brandingPublicDir, "logo-black.svg");
  const logoWhitePath = resolve(brandingPublicDir, "logo-white.svg");
  const headerLogoBlackPath = resolve(brandingPublicDir, "header-logo-black.svg");
  const headerLogoWhitePath = resolve(brandingPublicDir, "header-logo-white.svg");
  const faviconSvgPath = resolve(brandingPublicDir, "favicon.svg");
  const mfRoot = resolve(frontRoot, "microfrontends");
  const localesDir = resolve(frontRoot, "front-core/locales");
  const storeWorkersDir = resolve(frontRoot, "libraries/store-workers/dist");

  // Prebuilt paths (prod)
  const prebuiltFrontCorePath = resolve(projectRoot, "dist", "front", "index.js");
  const prebuiltFrontCoreMapPath = resolve(projectRoot, "dist", "front", "index.js.map");
  const prebuiltFrontVendorDir = resolve(projectRoot, "dist", "front", "vendor");
  const prebuiltMfDir = resolve(projectRoot, "dist", "mf");

  // Dev caches
  const vendorBundles = new Map<string, Blob>();
  let frontCoreBundle: Blob | null = null;
  const mfBundles = new Map<string, Blob>();

  // Prod caches
  let frontCoreBrotli: Uint8Array;
  const mfBrotli = new Map<string, Uint8Array>();

  const mfDirs = [resolve(frontRoot, "microfrontends")];
  if (parentProjectRoot) {
    mfDirs.push(resolve(parentProjectRoot, "front/microfrontends"));
  }

  const log = (message: string, extra?: Record<string, unknown>) => {
    if (extra) {
      console.log(`[spa] ${message}`, extra);
    } else {
      console.log(`[spa] ${message}`);
    }
  };

  const buildResolverPlugin = () =>
    createWorkspaceResolverPlugin(projectRoot, parentProjectRoot);

  function supportsEncoding(request: Request, encoding: string): boolean {
    const accept = request.headers.get("accept-encoding") || "";
    return accept.includes(encoding);
  }

  // --- Vendor ---

  const vendorTmpDir = resolve(import.meta.dir, "..", ".vendor-src");
  mkdirSync(vendorTmpDir, { recursive: true });

  async function buildVendorModule(fileName: string): Promise<Blob> {
    if (vendorBundles.has(fileName)) return vendorBundles.get(fileName)!;
    const specifier = vendorEntries[fileName];
    if (!specifier) throw new Error(`Unknown vendor module: ${fileName}`);

    const wrapper = buildVendorWrapper(specifier, specifier);
    const wrapperPath = resolve(vendorTmpDir, `${fileName.replace(/[^a-zA-Z0-9]/g, "_")}.ts`);
    await Bun.write(wrapperPath, wrapper);

    // For subpath specifiers (e.g. react-dom/client), parent package must
    // also be non-external; otherwise Bun may leave unresolved/broken links.
    const parentPkg = specifier.includes("/")
      ? specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/")
      : null;
    const externals = sharedExternals.filter(
      (s) => s !== specifier && s !== parentPkg,
    );

    const result = await Bun.build({
      entrypoints: [wrapperPath],
      target: "browser",
      format: "esm",
      minify: false,
      bundle: true,
      external: externals,
    });

    if (!result.success || result.outputs.length === 0) {
      const errors = result.logs.map((l) => l.message).join("\n");
      throw new Error(`Vendor build failed for ${specifier}:\n${errors}`);
    }

    const blob = result.outputs[0];
    vendorBundles.set(fileName, blob);
    log("vendor:built", { module: specifier });
    return blob;
  }

  // --- Front-core ---

  async function ensureFrontCore(): Promise<Blob> {
    if (frontCoreBundle) return frontCoreBundle;

    if (isProd) {
      const file = Bun.file(prebuiltFrontCorePath);
      if (!(await file.exists())) {
        throw new Error(`Missing prebuilt front-core: ${prebuiltFrontCorePath}`);
      }
      frontCoreBundle = file;
      const bytes = await file.arrayBuffer();
      frontCoreBrotli = Bun.gzipSync(Buffer.from(bytes), { level: 6 });
      log("front-core:prebuilt");
      return frontCoreBundle;
    }

    const entry = resolve(frontRoot, "front-core/src/index.ts");
    const result = await Bun.build({
      entrypoints: [entry],
      format: "esm",
      minify: false,
      external: externalPackages,
      plugins: [buildResolverPlugin()],
    });

    if (!result.success || result.outputs.length === 0) {
      const errors = result.logs.map((l) => l.message).join("\n");
      throw new Error(`front-core build failed:\n${errors}`);
    }

    frontCoreBundle = result.outputs[0];
    log("front-core:built", { kb: Number((frontCoreBundle.size / 1024).toFixed(0)) });
    return frontCoreBundle;
  }

  // --- Microfrontends ---

  async function ensureMicrofrontend(name: string): Promise<Blob> {
    if (mfBundles.has(name)) return mfBundles.get(name)!;

    if (isProd) {
      const prebuiltPath = resolve(prebuiltMfDir, `${name}.js`);
      const file = Bun.file(prebuiltPath);
      if (!(await file.exists())) {
        throw new Error(`Missing prebuilt microfrontend: ${prebuiltPath}`);
      }
      mfBundles.set(name, file);
      const bytes = await file.arrayBuffer();
      mfBrotli.set(name, Bun.gzipSync(Buffer.from(bytes), { level: 6 }));
      return file;
    }

    let entry: string | null = null;
    for (const dir of mfDirs) {
      const tsEntry = resolve(dir, name, "src/index.ts");
      const tsxEntry = resolve(dir, name, "src/index.tsx");
      if (existsSync(tsEntry)) { entry = tsEntry; break; }
      if (existsSync(tsxEntry)) { entry = tsxEntry; break; }
    }
    if (!entry) {
      throw new Error(`Microfrontend ${name} not found in any mfDir`);
    }

    const result = await Bun.build({
      entrypoints: [entry],
      format: "esm",
      minify: false,
      external: externalPackages,
      plugins: [buildResolverPlugin()],
    });

    if (!result.success || result.outputs.length === 0) {
      const errors = result.logs.map((l) => l.message).join("\n");
      throw new Error(`${name} build failed:\n${errors}`);
    }

    const blob = result.outputs[0];
    mfBundles.set(name, blob);
    log("mf:built", { name });
    return blob;
  }

  // --- MF name resolution ---

  function resolveMfName(
    params: Record<string, string> | undefined,
    request: Request,
  ): string | null {
    const raw = params?.name ?? (params as any)?.["name.js"];
    if (raw && raw.length > 0) return raw;
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(/^\/mf\/(.+?)(?:\.js)?$/);
    return match?.[1] ?? null;
  }

  // --- Elysia plugin ---

  const app = new Elysia({ name: "spa" })
    .get("/logo-black.svg", ({ set }) => {
      if (!existsSync(logoBlackPath)) {
        set.status = 404;
        return "Not Found";
      }
      return new Response(Bun.file(logoBlackPath), {
        headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
      });
    })
    .get("/logo-white.svg", ({ set }) => {
      if (!existsSync(logoWhitePath)) {
        set.status = 404;
        return "Not Found";
      }
      return new Response(Bun.file(logoWhitePath), {
        headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
      });
    })
    .get("/header-logo-black.svg", ({ set }) => {
      if (!existsSync(headerLogoBlackPath)) {
        set.status = 404;
        return "Not Found";
      }
      return new Response(Bun.file(headerLogoBlackPath), {
        headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
      });
    })
    .get("/header-logo-white.svg", ({ set }) => {
      if (!existsSync(headerLogoWhitePath)) {
        set.status = 404;
        return "Not Found";
      }
      return new Response(Bun.file(headerLogoWhitePath), {
        headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
      });
    })
    .get("/favicon.svg", ({ set }) => {
      if (!existsSync(faviconSvgPath)) {
        set.status = 404;
        return "Not Found";
      }
      return new Response(Bun.file(faviconSvgPath), {
        headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
      });
    })
    .get("/favicon.ico", ({ set }) => {
      if (!existsSync(faviconSvgPath)) {
        set.status = 404;
        return "Not Found";
      }
      set.redirect = "/favicon.svg";
      set.status = 302;
      return "";
    })
    .get("/vendor/*", async ({ request, set }) => {
      const fileName = new URL(request.url).pathname.replace("/vendor/", "");
      const contentType = fileName.endsWith(".map")
        ? "application/json; charset=utf-8"
        : "application/javascript; charset=utf-8";

      if (isProd) {
        const filePath = resolve(prebuiltFrontVendorDir, fileName);
        if (!filePath.startsWith(prebuiltFrontVendorDir) || !existsSync(filePath)) {
          set.status = 404;
          return "Not Found";
        }
        return new Response(Bun.file(filePath), {
          headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
        });
      }

      if (!vendorEntries[fileName]) {
        set.status = 404;
        return "Not Found";
      }

      try {
        const blob = await buildVendorModule(fileName);
        return new Response(blob, {
          headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
        });
      } catch (err: any) {
        console.error(`[spa] vendor build error for ${fileName}:`, err);
        set.status = 500;
        return { error: err?.message ?? "Vendor build failed" };
      }
    })
    .get("/front-core.js", async ({ request, set }) => {
      try {
        const bundle = await ensureFrontCore();
        if (isProd && supportsEncoding(request, "gzip")) {
          return new Response(frontCoreBrotli, {
            headers: {
              "Content-Type": "application/javascript; charset=utf-8",
              "Content-Encoding": "gzip",
              "Cache-Control": "no-store",
            },
          });
        }
        return new Response(bundle, {
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      } catch (err: any) {
        set.status = 500;
        return { error: err?.message ?? "front-core build failed" };
      }
    })
    .get("/index.js.map", ({ set }) => {
      if (!existsSync(prebuiltFrontCoreMapPath)) {
        set.status = 404;
        return "Not Found";
      }
      return new Response(Bun.file(prebuiltFrontCoreMapPath), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    })
    .get("/mf/:name.js", async ({ params, request, set }) => {
      const rawName = resolveMfName(params, request);
      if (!rawName) {
        set.status = 400;
        return { error: "Missing microfrontend name" };
      }
      const cleaned = rawName.endsWith(".js") ? rawName.slice(0, -3) : rawName;
      const name = cleaned.startsWith("mf-") ? cleaned : `mf-${cleaned}`;

      if (microfrontends.length > 0 && !microfrontends.includes(name)) {
        set.status = 404;
        return { error: "Unknown microfrontend" };
      }

      try {
        const bundle = await ensureMicrofrontend(name);
        if (isProd && supportsEncoding(request, "gzip")) {
          const gz = mfBrotli.get(name);
          if (gz) {
            return new Response(gz, {
              headers: {
                "Content-Type": "application/javascript; charset=utf-8",
                "Content-Encoding": "gzip",
                "Cache-Control": "no-store",
              },
            });
          }
        }
        return new Response(bundle, {
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      } catch (err: any) {
        console.error(`[spa] ${name} build failed:`, err);
        set.status = 500;
        return { error: err?.message ?? "Microfrontend build failed" };
      }
    })
    .get("/locales/:lng/mf-menu.json", async ({ params }) => {
      const lng = params.lng;
      const merged: Record<string, string> = {};
      for (const mf of microfrontends) {
        for (const dir of mfDirs) {
          const localePath = resolve(dir, mf, "locales", `${lng}.json`);
          if (existsSync(localePath)) {
            try {
              const content = await Bun.file(localePath).json();
              Object.assign(merged, content);
            } catch { /* ignore */ }
            break;
          }
        }
      }
      return new Response(JSON.stringify(merged), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    })
    .get("/locales/:lng/:file", async ({ params }) => {
      const { lng, file } = params;
      const coreLocalePath = resolve(localesDir, lng, file);
      if (coreLocalePath.startsWith(localesDir) && existsSync(coreLocalePath)) {
        return new Response(Bun.file(coreLocalePath), {
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }

      if (file.endsWith(".json")) {
        const namespace = file.slice(0, -5);
        if (namespace.startsWith("mf-")) {
          for (const dir of mfDirs) {
            const localePath = resolve(dir, namespace, "locales", `${lng}.json`);
            if (!localePath.startsWith(dir)) continue;
            if (!existsSync(localePath)) continue;
            return new Response(Bun.file(localePath), {
              headers: { "Content-Type": "application/json; charset=utf-8" },
            });
          }
        }
      }

      return new Response("{}", {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    })
    .get("/locales/*", ({ request }) => {
      const pathname = new URL(request.url).pathname.replace("/locales/", "");
      const filePath = resolve(localesDir, pathname);
      if (filePath.startsWith(localesDir) && existsSync(filePath)) {
        return new Response(Bun.file(filePath));
      }
      return new Response("{}", {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    })
    .get("/libraries/store-workers/dist/*", ({ request, set }) => {
      const pathname = new URL(request.url).pathname.replace("/libraries/store-workers/dist/", "");
      const filePath = resolve(storeWorkersDir, pathname);
      if (!filePath.startsWith(storeWorkersDir) || !existsSync(filePath)) {
        set.status = 404;
        return "Not Found";
      }
      return new Response(Bun.file(filePath), {
        headers: { "Content-Type": "application/javascript; charset=utf-8" },
      });
    });

  return app;
}
