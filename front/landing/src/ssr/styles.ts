import fs from "fs/promises";
import path from "path";
import { createGenerator } from "unocss";
import unoConfig from "../../uno.config";

const landingRoot = path.resolve(import.meta.dir, "../..");
const projectRoot =
  process.env.PROJECT_DIR ?? path.resolve(landingRoot, "../..");
const envParentProjectRoot =
  process.env.CHILD_PROJECT_DIR && process.env.CHILD_PROJECT_DIR.length > 0
    ? process.env.CHILD_PROJECT_DIR
    : undefined;
const projectRoots = Array.from(
  new Set(
    [projectRoot, envParentProjectRoot].filter(
      (root): root is string => Boolean(root),
    ),
  ),
);

// SSR sources — only what renders on the server (landing pages, front-landings sections)
const ssrSourceRoots = Array.from(
  new Set([
    path.join(landingRoot, "src"),
    ...projectRoots.map((root) =>
      path.resolve(root, "../../..", "saas", "public", "front", "front-landings", "src"),
    ),
  ]),
);

// SPA sources — microfrontends, front-core components, libraries (everything else)
const spaSourceRoots = Array.from(
  new Set(
    projectRoots.flatMap((root) => [
      path.join(root, "front", "front-core", "src"),
      path.join(root, "front", "microfrontends"),
      path.join(root, "front", "libraries"),
    ]),
  ),
);

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function readFileSafe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

async function collectSources(dir: string, sources: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules") continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectSources(fullPath, sources);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!allowedExtensions.has(path.extname(entry.name))) continue;

    const contents = await readFileSafe(fullPath);
    if (contents) sources.push(contents);
  }
}

function stripUnoDirectives(css: string): string {
  return css
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("@unocss")) return false;
      if (trimmed.startsWith('@import "@unocss/reset')) return false;
      if (trimmed.startsWith("@import '@unocss/reset")) return false;
      return true;
    })
    .join("\n");
}

async function loadResetCss(): Promise<string> {
  let resetCss = await readFileSafe(
    path.join(landingRoot, "node_modules", "@unocss", "reset", "tailwind.css")
  );
  if (!resetCss) {
    resetCss = await readFileSafe(
      path.join(projectRoot, "node_modules", "@unocss", "reset", "tailwind.css")
    );
  }
  return resetCss;
}

/**
 * Parse CSS rules into a Set of selectors for deduplication.
 */
function extractRuleSelectors(css: string): Set<string> {
  const selectors = new Set<string>();
  const ruleRegex = /^([^@{}][^{]*)\{/gm;
  let match;
  while ((match = ruleRegex.exec(css)) !== null) {
    const sel = match[1].trim();
    if (sel) selectors.add(sel);
  }
  return selectors;
}

/**
 * Remove CSS rules whose selectors appear in the exclusion set.
 */
function subtractCssRules(css: string, excludeSelectors: Set<string>): string {
  const lines = css.split("\n");
  const result: string[] = [];
  let skip = false;
  let braceDepth = 0;

  for (const line of lines) {
    if (skip) {
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }
      if (braceDepth <= 0) {
        skip = false;
        braceDepth = 0;
      }
      continue;
    }

    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("@") && trimmed.endsWith("{")) {
      const selector = trimmed.slice(0, -1).trim();
      if (excludeSelectors.has(selector)) {
        skip = true;
        braceDepth = 1;
        for (let i = trimmed.indexOf("{") + 1; i < trimmed.length; i++) {
          if (trimmed[i] === "{") braceDepth++;
          if (trimmed[i] === "}") braceDepth--;
        }
        if (braceDepth <= 0) {
          skip = false;
          braceDepth = 0;
        }
        continue;
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

/**
 * Build SSR-only styles — scanned from landing/src and front-landings only.
 * Includes reset, preflights, globals.css, and UnoCSS utilities.
 */
export async function buildStyles(): Promise<string> {
  const sources: string[] = [];
  for (const dir of ssrSourceRoots) {
    await collectSources(dir, sources);
  }

  const uno = await createGenerator(unoConfig);
  const { css: unoCss } = await uno.generate(sources.join("\n"), {
    preflights: true,
  });

  const resetCss = await loadResetCss();
  const globalsCss = await readFileSafe(
    path.join(landingRoot, "src", "app", "globals.css")
  );

  return [resetCss, unoCss, stripUnoDirectives(globalsCss)]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build SPA-only styles — scanned from microfrontends, front-core, libraries.
 * Excludes any rules already present in the SSR stylesheet to avoid duplication.
 */
export async function buildSpaStyles(): Promise<string> {
  const spaSources: string[] = [];
  for (const dir of spaSourceRoots) {
    await collectSources(dir, spaSources);
  }

  const uno = await createGenerator(unoConfig);
  const { css: spaCss } = await uno.generate(spaSources.join("\n"), {
    preflights: false,
  });

  const ssrSources: string[] = [];
  for (const dir of ssrSourceRoots) {
    await collectSources(dir, ssrSources);
  }
  const { css: ssrCss } = await uno.generate(ssrSources.join("\n"), {
    preflights: false,
  });

  const ssrSelectors = extractRuleSelectors(ssrCss);
  return subtractCssRules(spaCss, ssrSelectors);
}
