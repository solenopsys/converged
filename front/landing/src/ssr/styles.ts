import fs from "fs/promises";
import path from "path";
import { createGenerator } from "unocss";
import unoConfig from "../../uno.config";

const landingRoot = path.resolve(import.meta.dir, "../..");
const projectRoot =
  process.env.PROJECT_DIR ?? path.resolve(landingRoot, "../..");
const frontRoot = path.join(projectRoot, "front");
const frontLandingsRoot = path.resolve(
  projectRoot,
  "../../..",
  "saas",
  "public",
  "front",
  "front-landings",
  "src",
);

const sourceRoots = [
  path.join(landingRoot, "src"),
  path.join(frontRoot, "front-core", "src"),
  path.join(frontRoot, "microfrontends"),
  path.join(frontRoot, "libraries"),
  frontLandingsRoot,
];
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

export async function buildStyles(): Promise<string> {
  const sources: string[] = [];

  for (const dir of sourceRoots) {
    await collectSources(dir, sources);
  }

  const uno = await createGenerator(unoConfig);
  const { css: unoCss } = await uno.generate(sources.join("\n"), {
    preflights: true,
  });

  let resetCss = await readFileSafe(
    path.join(landingRoot, "node_modules", "@unocss", "reset", "tailwind.css")
  );
  if (!resetCss) {
    resetCss = await readFileSafe(
      path.join(projectRoot, "node_modules", "@unocss", "reset", "tailwind.css")
    );
  }
  const globalsCss = await readFileSafe(
    path.join(landingRoot, "src", "app", "globals.css")
  );

  return [resetCss, unoCss, stripUnoDirectives(globalsCss)]
    .filter(Boolean)
    .join("\n");
}
