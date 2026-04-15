import { resolve } from "path";
import { spawn, type Subprocess } from "bun";
import { existsSync, readFileSync } from "fs";
import type { BuildConfig } from "../types";

const PROJECTS_DIR = resolve(import.meta.dir, "../../../../../");

export interface DevOptions {
  projectName: string;
  port: number;
  compress?: boolean;
  envFile?: string;
}

/**
 * Parse .env file content. Handles:
 *  - comments (#), blank lines
 *  - `export KEY=val`
 *  - single/double quoted values
 *  - escape sequences in double-quoted values (\n, \r, \t, \\, \")
 *  - inline comments for unquoted values
 */
function parseDotEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ")
      ? line.slice(7).trim()
      : line;
    const eqIndex = normalized.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = normalized.slice(0, eqIndex).trim();
    if (!key || !/^[a-zA-Z_]\w*$/.test(key)) continue;

    let value = normalized.slice(eqIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else {
      const commentIdx = value.indexOf(" #");
      if (commentIdx >= 0) value = value.slice(0, commentIdx).trim();
    }

    env[key] = value;
  }

  return env;
}

function loadDotEnvForSpawn(
  projectDir: string,
  envFile?: string,
) {
  if (!envFile) {
    throw new Error("[configurator] --env-file is required for dev command");
  }

  const explicitPath = resolve(projectDir, envFile);
  if (!existsSync(explicitPath)) {
    throw new Error(`[configurator] --env-file not found: ${explicitPath}`);
  }
  const parsed = parseDotEnv(readFileSync(explicitPath, "utf8"));
  console.log(`[configurator] Loaded env from: ${explicitPath}`);

  return {
    ...parsed,
    ...process.env,
  };
}

async function loadConfig(projectDir: string): Promise<BuildConfig> {
  const configPath = resolve(projectDir, "config.json");
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    throw new Error(`Config not found: ${configPath}`);
  }
  return await file.json() as BuildConfig;
}

function mergeStringArrays(base: string[] = [], extra: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...base, ...extra]) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

async function loadMergedConfig(
  projectName: string,
): Promise<{ config: BuildConfig; projectDir: string; parentDir?: string }> {
  const projectDir = resolve(PROJECTS_DIR, projectName);
  const config = await loadConfig(projectDir);

  if (!config.extends) {
    return { config, projectDir };
  }

  const parentDir = resolve(PROJECTS_DIR, config.extends);
  const parentConfig = await loadConfig(parentDir);

  // Merge: parent microservices + child microservices
  const merged: BuildConfig = {
    ...config,
    cache: config.cache ?? parentConfig.cache,
    frontend: config.frontend ?? parentConfig.frontend,
    spa: {
      core: config.spa.core || parentConfig.spa.core,
      microfrontends: mergeStringArrays(
        parentConfig.spa.microfrontends,
        config.spa.microfrontends,
      ),
    },
    back: {
      core: config.back.core || parentConfig.back.core,
      microservices: {
        ...parentConfig.back.microservices,
        ...config.back.microservices,
      },
    },
  };

  return { config: merged, projectDir, parentDir };
}

export async function runDev({ projectName, port, compress, envFile }: DevOptions) {
  const { config, projectDir, parentDir } = await loadMergedConfig(projectName);
  const loadedEnv = loadDotEnvForSpawn(projectDir, envFile);
  const dataRoot = resolve(PROJECTS_DIR, "..", "data");
  const projectDataDir = resolve(
    dataRoot,
    projectName === "club-portal" ? "club" : "converged",
  );
  const runtimeEnv = {
    ...loadedEnv,
    DATA_DIR: process.env.DATA_DIR
      || loadedEnv.DATA_DIR
      || (existsSync(projectDataDir) ? projectDataDir : dataRoot),
  };

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Configurator — Development Server                      ║
║  Project: ${projectName.padEnd(45)}║
║  Services: ${Object.values(config.back.microservices).flat().length.toString().padEnd(44)}║
║  Microfrontends: ${config.spa.microfrontends.length.toString().padEnd(37)}║
╚══════════════════════════════════════════════════════════╝
`);

  // Generate icons shim before starting
  const frontCoreDir = parentDir
    ? resolve(parentDir, "front/front-core")
    : resolve(projectDir, "front/front-core");
  const shimScript = resolve(frontCoreDir, "src/tools/shim.ts");
  if (existsSync(shimScript)) {
    const mfDirs: string[] = [];
    if (parentDir) mfDirs.push(resolve(parentDir, "front/microfrontends"));
    mfDirs.push(resolve(projectDir, "front/microfrontends"));

    console.log("[dev] Generating icons shim...");
    const shimProc = spawn({
      cmd: ["bun", "run", shimScript, ...mfDirs.filter(d => existsSync(d))],
      cwd: frontCoreDir,
      stdout: "inherit",
      stderr: "inherit",
    });
    await shimProc.exited;
  }

  const procs: Subprocess[] = [];
  const cleanup = () => {
    console.log("\nShutting down...");
    for (const p of procs) p.kill();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Determine the base dir for back-core
  const backCoreDir = parentDir
    ? resolve(parentDir, config.back.core || "back/back-core")
    : resolve(projectDir, config.back.core || "back/back-core");

  console.log(`[mono] Starting on port ${port}...`);
  const monoProc = spawn({
    cmd: ["bun", "run", "dev"],
    cwd: backCoreDir,
    env: {
      ...runtimeEnv,
      PORT: String(port),
      PROJECT_DIR: projectDir,
      CHILD_PROJECT_DIR: parentDir || "",
      MONOLITH: "1",
      ...(compress ? { SPA_DEV_COMPRESS: "1" } : {}),
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  procs.push(monoProc);

  console.log(`
  App:  http://localhost:${port}
`);

  await Promise.race(procs.map((p) => p.exited));
  cleanup();
}
