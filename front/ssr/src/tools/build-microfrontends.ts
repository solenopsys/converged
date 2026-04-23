import { existsSync, mkdirSync, readdirSync } from "fs";
import { brotliCompressSync, constants as zlibConstants } from "zlib";
import { resolve } from "path";
import { externalPackages, microfrontends } from "front-core/runtime-config";
import { createWorkspaceResolverPlugin } from "front-core/workspace-resolver";

const landingRoot = process.cwd();
const projectRoot = process.env.PROJECT_DIR ?? resolve(landingRoot, "..", "..");
const envParentProjectRoot =
  process.env.CHILD_PROJECT_DIR && process.env.CHILD_PROJECT_DIR.length > 0
    ? process.env.CHILD_PROJECT_DIR
    : undefined;
const siblingParentProjectRoot = (() => {
  if (envParentProjectRoot) return undefined;
  const siblingsRoot = resolve(projectRoot, "..");
  if (!existsSync(siblingsRoot)) return undefined;

  const candidates = readdirSync(siblingsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(siblingsRoot, entry.name))
    .filter((candidateRoot) => candidateRoot !== projectRoot)
    .filter((candidateRoot) =>
      existsSync(resolve(candidateRoot, "front", "microfrontends")),
    );

  return candidates.length === 1 ? candidates[0] : undefined;
})();
const parentProjectRoot = envParentProjectRoot ?? siblingParentProjectRoot;
const mfRoots = [projectRoot, parentProjectRoot].filter(
  (root): root is string => Boolean(root),
);
const outDir = resolve(projectRoot, "dist", "mf");

mkdirSync(outDir, { recursive: true });

type BuildOutput = Blob & { path: string; type: string };

function isJavaScriptOutput(output: BuildOutput): boolean {
  return output.type.includes("javascript") || output.path.endsWith(".js");
}

function isCssOutput(output: BuildOutput): boolean {
  return output.type.includes("css") || output.path.endsWith(".css");
}

async function injectCssIntoModule(
  module: BuildOutput,
  css: BuildOutput | undefined,
  id: string,
): Promise<string> {
  const jsText = await module.text();
  if (!css || css.size === 0) return jsText;

  const cssText = await css.text();
  const styleId = `mf-style-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const injector = [
    `const __mfCss = ${JSON.stringify(cssText)};`,
    `const __mfStyleId = ${JSON.stringify(styleId)};`,
    "if (typeof document !== \"undefined\" && !document.getElementById(__mfStyleId)) {",
    "  const style = document.createElement(\"style\");",
    "  style.id = __mfStyleId;",
    "  style.textContent = __mfCss;",
    "  document.head.appendChild(style);",
    "}",
    "",
  ].join("\n");

  return injector + jsText;
}

function resolveMicrofrontendEntry(root: string, name: string): string | undefined {
  const mfBase = resolve(root, "front", "microfrontends");
  const directTs = resolve(mfBase, name, "src", "index.ts");
  const directTsx = resolve(mfBase, name, "src", "index.tsx");
  if (existsSync(directTs)) return directTs;
  if (existsSync(directTsx)) return directTsx;
  if (!existsSync(mfBase)) return undefined;

  for (const group of readdirSync(mfBase, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const groupedTs = resolve(mfBase, group.name, name, "src", "index.ts");
    const groupedTsx = resolve(mfBase, group.name, name, "src", "index.tsx");
    if (existsSync(groupedTs)) return groupedTs;
    if (existsSync(groupedTsx)) return groupedTsx;
  }

  return undefined;
}

for (const name of microfrontends) {
  let entry: string | undefined;
  for (const root of mfRoots) {
    const candidate = resolveMicrofrontendEntry(root, name);
    if (candidate) {
      entry = candidate;
      break;
    }
  }

  if (!entry) {
    const rootsLabel = mfRoots
      .map((root) => resolve(root, "front", "microfrontends"))
      .join(", ");
    throw new Error(
      `Missing microfrontend entry for ${name} under: ${rootsLabel}`,
    );
  }

  const result = await Bun.build({
    entrypoints: [entry],
    target: "browser",
    format: "esm",
    minify: true,
    define: {
      "process.env.NODE_ENV": "\"production\"",
      "import.meta.env.PROD": "true",
      "import.meta.env.DEV": "false",
    },
    jsx: {
      runtime: "automatic",
    },
    external: externalPackages,
    plugins: [createWorkspaceResolverPlugin(projectRoot, parentProjectRoot)],
  });

  if (!result.success) {
    const errors = result.logs.map((l) => l.message).join("\n");
    throw new Error(`Failed to build ${name}:\n${errors}`);
  }

  const jsOutput = result.outputs.find(isJavaScriptOutput);
  if (!jsOutput) {
    throw new Error(`No JavaScript output emitted for ${name}`);
  }
  const cssOutput = result.outputs.find(isCssOutput);
  const jsText = await injectCssIntoModule(jsOutput, cssOutput, name);
  const jsBytes = new TextEncoder().encode(jsText);
  const outPath = resolve(outDir, `${name}.js`);
  await Bun.write(outPath, jsBytes);

  if (cssOutput) {
    await Bun.write(resolve(outDir, `${name}.css`), await cssOutput.text());
  }

  const compressed = brotliCompressSync(Buffer.from(jsBytes), {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
  });
  await Bun.write(outPath + ".br", compressed);

  console.log(`[landing] built ${name}.js (${(jsBytes.byteLength / 1024).toFixed(1)}kb → ${(compressed.byteLength / 1024).toFixed(1)}kb br)`);
}
