import { existsSync, mkdirSync, readdirSync } from "fs";
import { resolve } from "path";
import { externalPackages, microfrontends } from "front-core/runtime-config";
import { createWorkspaceResolverPlugin } from "front-core/workspace-resolver";

const landingRoot = process.cwd();
const projectRoot = process.env.PROJECT_DIR ?? resolve(landingRoot, "..", "..");
const envParentProjectRoot =
  process.env.PARENT_PROJECT_DIR && process.env.PARENT_PROJECT_DIR.length > 0
    ? process.env.PARENT_PROJECT_DIR
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

for (const name of microfrontends) {
  let entry: string | undefined;
  for (const root of mfRoots) {
    const tsEntry = resolve(root, "front", "microfrontends", name, "src", "index.ts");
    const tsxEntry = resolve(
      root,
      "front",
      "microfrontends",
      name,
      "src",
      "index.tsx",
    );
    if (existsSync(tsEntry)) {
      entry = tsEntry;
      break;
    }
    if (existsSync(tsxEntry)) {
      entry = tsxEntry;
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

  if (result.outputs.length === 0) {
    throw new Error(`No output emitted for ${name}`);
  }
  await Bun.write(resolve(outDir, `${name}.js`), result.outputs[0]);

  console.log(`[landing] built ${name}.js`);
}
