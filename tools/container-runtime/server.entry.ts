import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type RuntimeMap = {
  services: Record<string, string>;
  workflows?: {
    plugin?: string;
  };
  spa?: {
    plugin?: string;
  };
  landing?: {
    plugin?: string;
  };
};

const appRoot = process.env.APP_ROOT || process.cwd();
const projectDir = process.env.PROJECT_DIR || appRoot;
const port = Number(process.env.PORT || "3000");
const dataRoot = process.env.DATA_DIR || resolve(appRoot, "data");
const runtimeMapPath =
  process.env.RUNTIME_MAP_PATH || resolve(appRoot, "runtime-map.toml");
const pluginsRoot = resolve(appRoot, "plugins");
const binLibsPath =
  process.env.BIN_LIBS_PATH || resolve(pluginsRoot, "bin-libs");

function resolveNativeArch(runtimeArch: string): string {
  switch (runtimeArch) {
    case "x64":
      return "x86_64";
    case "arm64":
      return "aarch64";
    default:
      return "x86_64";
  }
}

function readRuntimeMap(path: string): RuntimeMap {
  const content = readFileSync(path, "utf8");
  return Bun.TOML.parse(content) as RuntimeMap;
}

async function importPlugin(path: string) {
  const mod = await import(pathToFileURL(path).href);
  const plugin = mod.default ?? mod.plugin ?? mod;
  if (typeof plugin !== "function") {
    throw new Error(`Invalid plugin export at ${path}`);
  }
  return plugin as (cfg: any) => any;
}

process.env.BIN_LIBS_PATH = binLibsPath;
process.env.PROJECT_DIR = projectDir;
if (!process.env.BUN_STANCHION_EXTENSION) {
  process.env.BUN_STANCHION_EXTENSION = resolve(
    binLibsPath,
    `libstanchion-${resolveNativeArch(process.arch)}-musl.so`,
  );
}

if (!existsSync(runtimeMapPath)) {
  throw new Error(`Runtime map not found: ${runtimeMapPath}`);
}

const runtimeMap = readRuntimeMap(runtimeMapPath);

const pluginEntries: Array<{
  key: string;
  path: string;
  plugin: (cfg: any) => any;
}> = [];
for (const [key, mappedPath] of Object.entries(runtimeMap.services || {})) {
  const pluginPath = mappedPath.startsWith("/")
    ? mappedPath
    : resolve(appRoot, mappedPath);
  if (!existsSync(pluginPath)) {
    throw new Error(`Mapped plugin file does not exist: ${pluginPath}`);
  }
  const plugin = await importPlugin(pluginPath);
  pluginEntries.push({ key, path: pluginPath, plugin });
}

const servicePaths: Record<string, string> = {};
for (const { key } of pluginEntries) {
  const name = key.split("/")[1];
  if (name) servicePaths[name] = resolve(dataRoot, name);
}

let workflows: any = {};
if (runtimeMap.workflows?.plugin) {
  const wfPath = runtimeMap.workflows.plugin.startsWith("/")
    ? runtimeMap.workflows.plugin
    : resolve(appRoot, runtimeMap.workflows.plugin);
  if (existsSync(wfPath)) {
    workflows = await import(pathToFileURL(wfPath).href);
  }
}

const pluginConfig = {
  dbPath: dataRoot,
  dataDir: dataRoot,
  openai: {
    key: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  },
  claude: {
    key: process.env.CLAUDE_API_KEY || "",
    model: process.env.CLAUDE_MODEL || "claude-3-5-haiku-20241022",
  },
  servicePaths,
  workflows,
};

const serveStatic = async (dir: string, path: string) => {
  const requested = path === "/" ? "/index.html" : path;
  const file = Bun.file(resolve(dir, `.${requested}`));
  if (await file.exists()) return file;
  const fallback = Bun.file(resolve(dir, "index.html"));
  if (await fallback.exists()) return fallback;
  return null;
};

const serveFile = async (absPath: string) => {
  const file = Bun.file(absPath);
  if (await file.exists()) return file;
  return new Response("Not Found", { status: 404 });
};

const frontDir = resolve(appRoot, "dist/front");
const frontVendorDir = resolve(frontDir, "vendor");
const mfDir = resolve(appRoot, "dist/mf");
const landingPublicDir = resolve(appRoot, "front", "landing", "public");
const frontLocalesDir = resolve(appRoot, "front", "front-core", "locales");
const hasFront = (() => {
  try {
    return statSync(join(frontDir, "index.html")).isFile();
  } catch {
    return false;
  }
})();

const app = new Elysia()
  .use(cors())
  .get("/health", () => ({
    status: "ok",
    plugins: pluginEntries.length,
    timestamp: Date.now(),
  }))
  .group("/services", (api) => {
    for (const p of pluginEntries) {
      try {
        api.use(p.plugin(pluginConfig));
      } catch (err) {
        console.error("[runtime] plugin load failed:", p.path, err);
      }
    }
    return api;
  });

app
  .get("/vendor/*", async ({ params }) =>
    serveFile(resolve(frontVendorDir, params["*"] || "")),
  )
  .get("/mf/:name.js", async ({ params }) =>
    serveFile(resolve(mfDir, `${params.name}.js`)),
  )
  .get("/front-core.js", async () => serveFile(resolve(frontDir, "index.js")))
  .get("/favicon.svg", async () =>
    serveFile(resolve(landingPublicDir, "favicon.svg")),
  )
  .get("/locales/*", async ({ params }) =>
    serveFile(resolve(frontLocalesDir, params["*"] || "")),
  );

if (hasFront) {
  app
    .get("/console", async () => Bun.file(join(frontDir, "index.html")))
    .get("/console/*", async ({ params }) => {
      const result = await serveStatic(frontDir, `/${params["*"] || ""}`);
      return result ?? new Response("Not Found", { status: 404 });
    });
}

// SPA plugin — vendor libs, front-core, microfrontends
const spaPluginPath = runtimeMap.spa?.plugin
  ?? (existsSync(resolve(pluginsRoot, "spa/plugin.js"))
    ? resolve(pluginsRoot, "spa/plugin.js")
    : resolve(projectDir, "front/spa/src/plugin.ts"));
if (existsSync(spaPluginPath)) {
  const spaPlugin = await importPlugin(spaPluginPath);
  app.use(spaPlugin({ production: true }));
}

if (runtimeMap.landing?.plugin) {
  const landingPluginPath = runtimeMap.landing.plugin.startsWith("/")
    ? runtimeMap.landing.plugin
    : resolve(appRoot, runtimeMap.landing.plugin);
  if (!existsSync(landingPluginPath)) {
    throw new Error(`Landing plugin file does not exist: ${landingPluginPath}`);
  }
  const landingPlugin = await importPlugin(landingPluginPath);
  app.use(
    landingPlugin({
      production: true,
      publicDir: resolve(projectDir, "front", "landing", "public"),
    }),
  );
}

app.listen({ port, hostname: "0.0.0.0" });
console.log(
  `[converged-app] http://localhost:${port} plugins=${pluginEntries.length}`,
);
