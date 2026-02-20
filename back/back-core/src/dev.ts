import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";
import { createServer, loadConfigFromEnv } from "./server/createServer";

type BuildConfig = {
  name?: string;
  extends?: string;
  back: {
    core?: string;
    microservices: Record<string, string[]>;
  };
  spa?: {
    core?: string;
    microfrontends?: string[];
  };
};

const PROJECT_DIR =
  process.env.PROJECT_DIR ??
  resolve(import.meta.dir, "../../..");

const PARENT_PROJECT_DIR =
  process.env.PARENT_PROJECT_DIR && process.env.PARENT_PROJECT_DIR.length > 0
    ? process.env.PARENT_PROJECT_DIR
    : undefined;

const ROOT = resolve(PROJECT_DIR, "../../..");

function parseDotEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ")
      ? line.slice("export ".length).trim()
      : line;
    const eqIndex = normalized.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = normalized.slice(0, eqIndex).trim();
    let value = normalized.slice(eqIndex + 1).trim();
    if (!key) continue;

    const isDoubleQuoted = value.startsWith("\"") && value.endsWith("\"");
    const isSingleQuoted = value.startsWith("'") && value.endsWith("'");
    if (isDoubleQuoted || isSingleQuoted) {
      value = value.slice(1, -1);
      if (isDoubleQuoted) {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t");
      }
    } else {
      const inlineCommentIdx = value.indexOf(" #");
      if (inlineCommentIdx >= 0) {
        value = value.slice(0, inlineCommentIdx).trim();
      }
    }

    env[key] = value;
  }

  return env;
}

function loadDotEnvFiles(projectDir: string, parentDir?: string) {
  const legacyBootstrapDir = process.env.BOOTSTRAP_ENV_DIR;
  const dirCandidates = [
    projectDir,
    parentDir,
    legacyBootstrapDir,
    resolve(ROOT, "saas/private/club-bootstrap"),
    resolve(ROOT, "saas/public/saas-bootstrap"),
  ].filter(
    (value): value is string => Boolean(value),
  );
  const dirs = Array.from(new Set(dirCandidates));
  const names = [".env", ".env.local", ".env.development", ".env.development.local"];

  const loadedFiles: string[] = [];
  let loadedKeys = 0;

  for (const dir of dirs) {
    for (const name of names) {
      const envPath = resolve(dir, name);
      if (!existsSync(envPath)) continue;

      const parsed = parseDotEnv(readFileSync(envPath, "utf8"));
      loadedFiles.push(envPath);

      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] !== undefined) continue;
        process.env[key] = value;
        loadedKeys += 1;
      }
    }
  }

  if (loadedFiles.length > 0) {
    console.log(
      `[back-core] Loaded ${loadedKeys} env keys from ${loadedFiles.length} .env file(s)`,
    );
  }
}

async function loadConfig(configPath: string): Promise<BuildConfig> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    throw new Error(`Config not found: ${configPath}`);
  }
  return file.json();
}

async function loadMergedConfig(projectDir: string, parentDir?: string) {
  const configPath = process.env.CONFIG_PATH || resolve(projectDir, "config.json");
  const config = await loadConfig(configPath);
  if (!config.extends || !parentDir) {
    return { config, parentDir: undefined };
  }

  const parentConfig = await loadConfig(resolve(parentDir, "config.json"));
  const merged: BuildConfig = {
    ...config,
    back: {
      core: config.back.core || parentConfig.back.core,
      microservices: {
        ...parentConfig.back.microservices,
        ...config.back.microservices,
      },
    },
    spa: {
      core: config.spa?.core || parentConfig.spa?.core,
      microfrontends: [
        ...(parentConfig.spa?.microfrontends ?? []),
        ...(config.spa?.microfrontends ?? []),
      ],
    },
  };

  return { config: merged, parentDir };
}

function resolveServiceDir(
  projectDir: string,
  parentDir: string | undefined,
  category: string,
  name: string,
) {
  const categorized = resolve(
    projectDir,
    "back/microservices",
    category,
    `ms-${name}`,
  );
  if (existsSync(categorized)) return categorized;
  const flat = resolve(projectDir, "back/microservices", `ms-${name}`);
  if (existsSync(flat)) return flat;
  if (parentDir) {
    const parentCategorized = resolve(
      parentDir,
      "back/microservices",
      category,
      `ms-${name}`,
    );
    if (existsSync(parentCategorized)) return parentCategorized;
    const parentFlat = resolve(
      parentDir,
      "back/microservices",
      `ms-${name}`,
    );
    if (existsSync(parentFlat)) return parentFlat;
  }
  return null;
}

function resolvePluginPath(svcDir: string) {
  const srcPluginPath = resolve(svcDir, "src/plugin.ts");
  if (existsSync(srcPluginPath)) return srcPluginPath;
  const rootPluginPath = resolve(svcDir, "plugin.ts");
  if (existsSync(rootPluginPath)) return rootPluginPath;
  return srcPluginPath;
}

async function loadPlugins(
  projectDir: string,
  parentDir: string | undefined,
  config: BuildConfig,
) {
  const plugins: Array<(config: any) => (app: any) => any> = [];
  const missing: string[] = [];

  for (const [category, services] of Object.entries(
    config.back.microservices,
  )) {
    for (const name of services) {
      const svcDir = resolveServiceDir(projectDir, parentDir, category, name);
      if (!svcDir) {
        missing.push(`${category}/${name}`);
        continue;
      }
      const pluginPath = resolvePluginPath(svcDir);
      try {
        const mod = await import(pathToFileURL(pluginPath).href);
        const pluginFactory = mod.default ?? mod.plugin ?? mod;
        if (typeof pluginFactory !== "function") {
          throw new Error(`Invalid plugin factory for ${category}/${name}`);
        }
        plugins.push(pluginFactory);
        continue;
      } catch (err) {
        console.error(
          `[back-core] Failed to import plugin ${category}/${name} at ${pluginPath}`,
        );
        throw err;
      }
    }
  }

  if (missing.length > 0) {
    console.warn(
      `[back-core] Missing microservices: ${missing.join(", ")}`,
    );
  }

  return plugins;
}

loadDotEnvFiles(PROJECT_DIR, PARENT_PROJECT_DIR);

const port = Number(process.env.PORT || process.env.SERVICES_PORT || 3000);
const dataDir = process.env.DATA_DIR || resolve(PROJECT_DIR, "data");

const { config, parentDir } = await loadMergedConfig(
  PROJECT_DIR,
  PARENT_PROJECT_DIR,
);

const plugins = await loadPlugins(PROJECT_DIR, parentDir, config);

const servicePaths: Record<string, string> = {};
for (const services of Object.values(config.back.microservices)) {
  for (const name of services) {
    servicePaths[name] = resolve(dataDir, name);
  }
}

// Load workflows from project's back/workflows package
let workflows: any = {};
const workflowsPath = resolve(PROJECT_DIR, "back/workflows/index.ts");
if (existsSync(workflowsPath)) {
  workflows = await import(pathToFileURL(workflowsPath).href);
}

const server = createServer({
  config: {
    ...loadConfigFromEnv(),
    name: config.name || "converged",
    port,
    dataDir,
    extraConfig: { servicePaths, workflows, apiKey: process.env.GOOGLE_API_KEY || "", cx: process.env.GOOGLE_CX || "" },
  },
  plugins,
});

// SPA plugin — vendor libs, front-core, microfrontends
const spaPath = resolve(PROJECT_DIR, "front/spa/src/plugin.ts");
if (existsSync(spaPath)) {
  const spaMod = await import(pathToFileURL(spaPath).href);
  const spaPlugin = spaMod.default ?? spaMod;
  if (typeof spaPlugin === "function") {
    server.app.use(spaPlugin({ production: false }));
  }
}

// Landing plugin — SSR pages, styles, client.js
if (config.landing) {
  const landingPath = resolve(
    PROJECT_DIR,
    config.landing,
    "src/plugin.tsx",
  );
  if (existsSync(landingPath)) {
    const landingMod = await import(pathToFileURL(landingPath).href);
    const landingPlugin = landingMod.default ?? landingMod;
    if (typeof landingPlugin === "function") {
      server.app.use(landingPlugin({ production: false }));
    }
  }
}

server.start();
