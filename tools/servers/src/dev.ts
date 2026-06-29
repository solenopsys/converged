#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import { spawn, type Subprocess } from "bun";

type BuildConfig = {
  name: string;
  extends?: string;
  cache?: unknown;
  frontend?: unknown;
  runtime?: unknown;
  runtimeDeps?: unknown;
  spa: {
    core?: string;
    microfrontends: string[];
  };
  back: {
    core?: string;
    microservices: Record<string, string[]>;
    runtimes?: Record<string, unknown>;
  };
};

const PROJECTS_DIR = resolve(import.meta.dir, "../../../..");
const DEFAULT_PROJECT = basename(resolve(import.meta.dir, "../../.."));

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    project: { type: "string", short: "p", default: DEFAULT_PROJECT },
    port: { type: "string" },
    "env-file": { type: "string", default: "../../confs/converged-portal.env" },
    compress: { type: "boolean", short: "c" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: false,
});

if (values.help) {
  console.log(`
Servers — development entrypoint

Usage:
  bun run tools/servers/src/dev.ts [options]

Options:
  -p, --project <name>     Project under clarity/projects (default: ${DEFAULT_PROJECT})
  --port <port>            HTTP port (default: PORT from env file, then 3000)
  --env-file <path>        Env file relative to project root (default: ../../confs/converged-portal.env)
  -c, --compress           Enable SPA_DEV_COMPRESS
  -h, --help               Show this help
`);
  process.exit(0);
}

function parseDotEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eqIndex = normalized.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = normalized.slice(0, eqIndex).trim();
    if (!key || !/^[a-zA-Z_]\w*$/.test(key)) continue;

    let value = normalized.slice(eqIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value
        .slice(1, -1)
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

function loadDotEnv(projectDir: string, envFile: string): Record<string, string> {
  const explicitPath = resolve(projectDir, envFile);
  if (!existsSync(explicitPath)) {
    throw new Error(`[servers] --env-file not found: ${explicitPath}`);
  }

  console.log(`[servers] Loaded env from: ${explicitPath}`);
  return {
    ...parseDotEnv(readFileSync(explicitPath, "utf8")),
    ...process.env,
  };
}

async function loadConfig(projectDir: string): Promise<BuildConfig> {
  const configPath = resolve(projectDir, "config.json");
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    throw new Error(`Config not found: ${configPath}`);
  }
  return (await file.json()) as BuildConfig;
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

function defaultDataDirName(configName: string): string {
  return configName.replace(/-portal$/, "") || configName;
}

function inferLocalStorageScope(env: Record<string, string | undefined>): string | undefined {
  const explicit = env.STORAGE_SCOPE?.trim();
  if (explicit) return explicit;

  const rawMap = env.WORKSPACE_DOMAIN_MAP || env.NRPC_WORKSPACE_DOMAIN_MAP;
  if (!rawMap) return undefined;

  try {
    const map = JSON.parse(rawMap) as Record<string, unknown>;
    for (const host of ["localhost", "127.0.0.1"]) {
      const scope = map[host];
      if (typeof scope === "string" && scope.trim()) return scope.trim();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function loadMergedConfig(projectName: string) {
  const projectDir = resolve(PROJECTS_DIR, projectName);
  const config = await loadConfig(projectDir);

  if (!config.extends) {
    return { config, projectDir };
  }

  const parentDir = resolve(PROJECTS_DIR, config.extends);
  const parentConfig = await loadConfig(parentDir);

  const merged: BuildConfig = {
    ...config,
    cache: config.cache ?? parentConfig.cache,
    frontend: config.frontend ?? parentConfig.frontend,
    runtime: config.runtime ?? parentConfig.runtime,
    runtimeDeps: config.runtimeDeps ?? parentConfig.runtimeDeps,
    spa: {
      core: config.spa.core || parentConfig.spa.core,
      microfrontends: mergeStringArrays(parentConfig.spa.microfrontends, config.spa.microfrontends),
    },
    back: {
      core: config.back.core || parentConfig.back.core,
      microservices: {
        ...parentConfig.back.microservices,
        ...config.back.microservices,
      },
      runtimes: {
        ...parentConfig.back.runtimes,
        ...config.back.runtimes,
      },
    },
  };

  return { config: merged, projectDir, parentDir };
}

async function runDev() {
  const projectName = values.project!;
  const { config, projectDir, parentDir } = await loadMergedConfig(projectName);
  const loadedEnv = loadDotEnv(projectDir, values["env-file"]!);
  const port = values.port
    ? Number.parseInt(values.port, 10)
    : Number.parseInt(loadedEnv.PORT ?? "3000", 10);
  if (!Number.isFinite(port)) {
    throw new Error(`[servers] invalid PORT value: ${values.port ?? loadedEnv.PORT}`);
  }

  const dataRoot = resolve(PROJECTS_DIR, "..", "data");
  const projectDataDir = resolve(dataRoot, defaultDataDirName(config.name));
  const dataDir = process.env.DATA_DIR || loadedEnv.DATA_DIR || (existsSync(projectDataDir) ? projectDataDir : dataRoot);
  const storagePort = Number(
    process.env.STORAGE_PORT
      || loadedEnv.STORAGE_PORT
      || config.storage.devPort
      || config.storage.port
      || 9000,
  );
  const hasTenantStorageMapping = Boolean(
    process.env.STORAGE_TENANT_SERVICES
      || loadedEnv.STORAGE_TENANT_SERVICES
      || process.env.STORAGE_SERVICE_PREFIX
      || loadedEnv.STORAGE_SERVICE_PREFIX,
  );
  const explicitStorageHost = process.env.STORAGE_HOST || loadedEnv.STORAGE_HOST;
  const localStorageScope = inferLocalStorageScope(loadedEnv);
  const runtimeEnv = {
    ...loadedEnv,
    DATA_DIR: dataDir,
    ...(localStorageScope ? { STORAGE_SCOPE: localStorageScope } : {}),
    STORAGE_TRANSPORT: process.env.STORAGE_TRANSPORT || loadedEnv.STORAGE_TRANSPORT || "tcp",
    ...(explicitStorageHost
      ? { STORAGE_HOST: explicitStorageHost }
      : hasTenantStorageMapping
        ? {}
        : { STORAGE_HOST: "127.0.0.1" }),
    STORAGE_PORT: String(storagePort),
  };

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Servers — Development                                  ║
║  Project: ${projectName.padEnd(45)}║
║  Services: ${Object.values(config.back.microservices).flat().length.toString().padEnd(44)}║
║  Microfrontends: ${config.spa.microfrontends.length.toString().padEnd(37)}║
╚══════════════════════════════════════════════════════════╝
`);

  const frontCoreDir = parentDir
    ? resolve(parentDir, "front/front-core")
    : resolve(projectDir, "front/front-core");
  const shimScript = resolve(frontCoreDir, "src/tools/shim.ts");
  if (existsSync(shimScript)) {
    const mfDirs: string[] = [];
    if (parentDir) mfDirs.push(resolve(parentDir, "front/microfrontends"));
    mfDirs.push(resolve(projectDir, "front/microfrontends"));

    console.log("[servers] Generating icons shim...");
    const shimProc = spawn({
      cmd: ["bun", "run", shimScript, ...mfDirs.filter((dir) => existsSync(dir))],
      cwd: frontCoreDir,
      stdout: "inherit",
      stderr: "inherit",
    });
    await shimProc.exited;
  }

  const procs: Subprocess[] = [];
  const cleanup = () => {
    console.log("\n[servers] Shutting down...");
    for (const proc of procs) proc.kill();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const backCoreDir = parentDir
    ? resolve(parentDir, config.back.core || "back/back-core")
    : resolve(projectDir, config.back.core || "back/back-core");

  console.log(`[servers] Starting on port ${port}...`);
  const monoProc = spawn({
    cmd: ["bun", "run", "dev"],
    cwd: backCoreDir,
    env: {
      ...runtimeEnv,
      PORT: String(port),
      PROJECT_DIR: projectDir,
      CHILD_PROJECT_DIR: parentDir || "",
      MONOLITH: "1",
      ...(values.compress ? { SPA_DEV_COMPRESS: "1" } : {}),
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  procs.push(monoProc);

  console.log(`
  App:  http://localhost:${port}
`);

  await Promise.race(procs.map((proc) => proc.exited));
  cleanup();
}

runDev().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
