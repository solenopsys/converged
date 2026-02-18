import fs from "fs/promises";
import path from "path";
import { createGenerator } from "unocss";
import { createRequire } from "module";
import unoConfig from "../../uno.config";

const sourceRoots = ["src", "../front-core/src"];
const allowedExtensions = new Set([".ts", ".tsx"]);

const require = createRequire(import.meta.url);

async function readFileSafe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

function stripUnoDirectives(css: string): string {
  return css
    .replace(/@unocss\\s+preflights;?/g, "")
    .replace(/@unocss\\s+default;?/g, "")
    .replace(/@import\\s+["']@unocss\\/reset\\/tailwind\\.css["'];?/g, "");
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

export async function buildStyles(): Promise<string> {
  const root = path.resolve(import.meta.dir, "../..");
  const sources: string[] = [];

  for (const dir of sourceRoots) {
    await collectSources(path.join(root, dir), sources);
  }

  const uno = await createGenerator(unoConfig);
  const { css } = await uno.generate(sources.join("\\n"), {
    preflights: true,
  });

  const globalsPath = path.join(root, "src/app/globals.css");
  const resetPath = require.resolve("@unocss/reset/tailwind.css");
  const resetCss = await readFileSafe(resetPath);
  const globalsCss = stripUnoDirectives(await readFileSafe(globalsPath));

  return [resetCss, globalsCss, css].filter(Boolean).join("\\n");
}
