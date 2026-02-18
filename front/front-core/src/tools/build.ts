import { mkdirSync, rmSync, statSync, writeFileSync } from "fs";
import { resolve } from "path";

const distDir = resolve(import.meta.dir, "..", "..", "dist");
const vendorDir = resolve(distDir, "vendor");
const vendorSrcDir = resolve(distDir, ".vendor-src");

const sharedExternals = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-router-dom",
  "effector",
  "effector-react",
  "lucide-react",
  "dagre",
  "pixi.js",
  "recharts",
  "sonner",
];

const vendorEntries: Array<{
  specifier: string;
  source: string;
  file: string;
}> = [
  { specifier: "react", source: "react", file: "react.js" },
  { specifier: "react-dom", source: "react-dom", file: "react-dom.js" },
  { specifier: "react-dom/client", source: "react-dom/client", file: "react-dom-client.js" },
  { specifier: "react/jsx-runtime", source: "react/jsx-runtime", file: "react-jsx-runtime.js" },
  {
    specifier: "react/jsx-dev-runtime",
    source: "react/jsx-dev-runtime",
    file: "react-jsx-dev-runtime.js",
  },
  { specifier: "react-router-dom", source: "react-router-dom", file: "react-router-dom.js" },
  { specifier: "effector", source: "effector", file: "effector.js" },
  { specifier: "effector-react", source: "effector-react", file: "effector-react.js" },
  { specifier: "lucide-react", source: "lucide-react", file: "lucide-react.js" },
  { specifier: "dagre", source: "dagre", file: "dagre.js" },
  { specifier: "pixi.js", source: "pixi.js", file: "pixi.js" },
  { specifier: "recharts", source: "recharts", file: "recharts.js" },
  { specifier: "sonner", source: "sonner", file: "sonner.js" },
];

const jsxRuntimeSources: Record<string, string> = {
  "react/jsx-runtime": resolve(
    import.meta.dir,
    "..",
    "..",
    "node_modules",
    "react",
    "cjs",
    "react-jsx-runtime.production.js",
  ),
  "react/jsx-dev-runtime": resolve(
    import.meta.dir,
    "..",
    "..",
    "node_modules",
    "react",
    "cjs",
    "react-jsx-dev-runtime.production.js",
  ),
};

function isBareSpecifier(specifier: string): boolean {
  if (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/")
  ) {
    return false;
  }
  return !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(specifier);
}

function collectBareImports(source: string): string[] {
  const specs = new Set<string>();
  const re =
    /(?:from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const specifier = match[1] ?? match[2];
    if (specifier && isBareSpecifier(specifier)) {
      specs.add(specifier);
    }
  }
  return [...specs];
}

function logSize(path: string): string {
  return `${(statSync(path).size / 1024).toFixed(1)}kb`;
}

rmSync(vendorDir, { recursive: true, force: true });
rmSync(vendorSrcDir, { recursive: true, force: true });
mkdirSync(vendorDir, { recursive: true });
mkdirSync(vendorSrcDir, { recursive: true });

function buildVendorWrapper(entry: (typeof vendorEntries)[number]): string {
  // react-dom: CJS module — explicit named exports so Bun can bundle it
  if (entry.specifier === "react-dom") {
    return [
      `import * as mod from "${entry.source}";`,
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
  // react-dom/client: subpath CJS — explicit exports (createRoot, hydrateRoot)
  if (entry.specifier === "react-dom/client") {
    return [
      `import * as mod from "${entry.source}";`,
      "const m = (mod as any).default ?? mod;",
      "export const createRoot = m.createRoot;",
      "export const hydrateRoot = m.hydrateRoot;",
      "export const version = m.version;",
      "export default m;",
    ].join("\n");
  }
  // jsx runtimes: use CJS production files directly
  if (
    entry.specifier === "react/jsx-runtime" ||
    entry.specifier === "react/jsx-dev-runtime"
  ) {
    return [
      `import * as mod from ${JSON.stringify(jsxRuntimeSources[entry.specifier])};`,
      "export const jsx = mod.jsx;",
      "export const jsxs = mod.jsxs;",
      "export const jsxDEV = (mod as any).jsxDEV;",
      "export const Fragment = mod.Fragment;",
      "export default mod;",
    ].join("\n");
  }
  // generic: re-export everything
  return [
    `import * as mod from "${entry.source}";`,
    `export * from "${entry.source}";`,
    "export default (mod as any).default ?? mod;",
  ].join("\n");
}

const imports: Record<string, string> = {};

for (const entry of vendorEntries) {
  const wrapperPath = resolve(
    vendorSrcDir,
    `${entry.file.replace(/[^a-zA-Z0-9]/g, "_")}.ts`,
  );
  const outPath = resolve(vendorDir, entry.file);
  const wrapper = buildVendorWrapper(entry);

  await Bun.write(wrapperPath, wrapper);

  // For sub-path entries (e.g. react-dom/client) the parent package (react-dom)
  // must NOT be external — otherwise Bun leaves bare imports unresolved.
  const parentPkg = entry.specifier.includes("/")
    ? entry.specifier.split("/").slice(0, entry.specifier.startsWith("@") ? 2 : 1).join("/")
    : null;
  const externalsForEntry = sharedExternals.filter(
    (name) => name !== entry.specifier && name !== parentPkg,
  );

  const result = await Bun.build({
    entrypoints: [wrapperPath],
    target: "browser",
    format: "esm",
    minify: true,
    bundle: true,
    external: externalsForEntry,
  });

  if (!result.success) {
    const errors = result.logs.map((item) => item.message).join("\n");
    throw new Error(`Failed to build vendor module ${entry.specifier}:\n${errors}`);
  }
  if (result.outputs.length === 0) {
    throw new Error(`Vendor build produced no output for ${entry.specifier}`);
  }

  await Bun.write(outPath, result.outputs[0]);

  imports[entry.specifier] = `/vendor/${entry.file}`;
  console.log(`[front-core] vendor ${entry.specifier} -> ${entry.file} (${logSize(outPath)})`);
}

const knownSpecifiers = vendorEntries
  .map((entry) => entry.specifier)
  .sort((a, b) => b.length - a.length);

for (const entry of vendorEntries) {
  const sourceText = await Bun.file(resolve(vendorDir, entry.file)).text();
  for (const specifier of collectBareImports(sourceText)) {
    if (imports[specifier]) continue;

    const prefix = knownSpecifiers.find(
      (known) => specifier === known || specifier.startsWith(`${known}/`),
    );
    if (!prefix) continue;

    imports[specifier] = imports[prefix];
  }
}

writeFileSync(
  resolve(distDir, "import-map.json"),
  JSON.stringify({ imports }, null, 2),
);
console.log(`[front-core] import-map.json (${Object.keys(imports).length} entries)`);

const appBuild = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "..", "index.ts")],
  outdir: distDir,
  write: true,
  format: "esm",
  minify: true,
  sourcemap: "linked",
  target: "browser",
  external: sharedExternals,
  jsx: { runtime: "automatic" },
  tsconfig: resolve(import.meta.dir, "..", "..", "tsconfig.json"),
});

if (!appBuild.success) {
  const errors = appBuild.logs.map((item) => item.message).join("\n");
  throw new Error(`Failed to build front-core:\n${errors}`);
}

const cssSource = await Bun.file(resolve(import.meta.dir, "..", "index.css")).text();
await Bun.write(resolve(distDir, "index.css"), cssSource);
rmSync(vendorSrcDir, { recursive: true, force: true });

console.log(`[front-core] index.js (${logSize(resolve(distDir, "index.js"))})`);
console.log(`[front-core] index.css (${logSize(resolve(distDir, "index.css"))})`);
