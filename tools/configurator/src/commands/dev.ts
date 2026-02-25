import { resolve } from "path";
import { spawn, type Subprocess } from "bun";
import { existsSync, readFileSync } from "fs";
import type { BuildConfig } from "../types";

const PROJECTS_DIR = resolve(import.meta.dir, "../../../../../");
const ROOT = resolve(PROJECTS_DIR, "../..");

export interface DevOptions {
  projectName: string;
  port: number;
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

function loadDotEnvForSpawn(projectName: string, projectDir: string, parentDir?: string) {
  const legacyBootstrapDirRaw = process.env.BOOTSTRAP_ENV_DIR;
  const legacyBootstrapDir = legacyBootstrapDirRaw
    ? resolve(projectDir, legacyBootstrapDirRaw)
    : undefined;
  const dirs = Array.from(
    new Set(
      [
        parentDir,
        projectDir,
        legacyBootstrapDir,
        resolve(ROOT, "saas/private/club-bootstrap"),
        resolve(ROOT, "saas/public/saas-bootstrap"),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const names = [
    `${projectName}.env`,
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
  ];
  const fromFiles: Record<string, string> = {};
  let filesCount = 0;

  for (const dir of dirs) {
    for (const name of names) {
      const envPath = resolve(dir, name);
      if (!existsSync(envPath)) continue;
      filesCount += 1;
      const parsed = parseDotEnv(readFileSync(envPath, "utf8"));
      Object.assign(fromFiles, parsed);
    }
  }

  if (filesCount > 0) {
    console.log(`[configurator] Loaded env from ${filesCount} .env file(s)`);
  }

  // Shell/exported variables keep priority over file values.
  return {
    ...fromFiles,
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
    spa: {
      core: config.spa.core || parentConfig.spa.core,
      microfrontends: [
        ...parentConfig.spa.microfrontends,
        ...config.spa.microfrontends,
      ],
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

export async function runDev({ projectName, port }: DevOptions) {
  const { config, projectDir, parentDir } = await loadMergedConfig(projectName);
  const loadedEnv = loadDotEnvForSpawn(projectName, projectDir, parentDir);
  const runtimeEnv = {
    ...loadedEnv,
    NODE_ENV: "development",
    DATA_DIR: process.env.DATA_DIR || resolve(PROJECTS_DIR, "..", "data"),
  };

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Configurator — Development Server                      ║
║  Project: ${projectName.padEnd(45)}║
║  Services: ${Object.values(config.back.microservices).flat().length.toString().padEnd(44)}║
║  Microfrontends: ${config.spa.microfrontends.length.toString().padEnd(37)}║
╚══════════════════════════════════════════════════════════╝
`);

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
      PARENT_PROJECT_DIR: parentDir || "",
      MONOLITH: "1",
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
