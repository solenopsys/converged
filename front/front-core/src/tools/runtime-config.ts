import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

type ProjectConfig = {
  extends?: string;
  spa?: {
    microfrontends?: string[];
  };
};

type ImportMapFile = {
  imports?: Record<string, string>;
};

const defaultSharedPackages = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-router-dom",
  "effector",
  "effector/effector.mjs",
  "effector-react",
  "echarts",
  "echarts-for-react",
  "lucide-react",
  "dagre",
  "pixi.js",
  "sonner",
  "framer-motion",
  "@dnd-kit/core",
  "@dnd-kit/sortable",
  "@tanstack/react-virtual",
  "@tanstack/react-table",
  "embla-carousel-react",
  "embla-carousel-autoplay",
  "vaul",
  "cmdk",
  "@textea/json-viewer",
  "front-core",
];

function uniq(items: string[]): string[] {
  return [...new Set(items)];
}

function ensureMfPrefix(name: string): string {
  return name.startsWith("mf-") ? name : `mf-${name}`;
}

function parseEnvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveProjectRoot(): string {
  return process.env.PROJECT_DIR ?? resolve(import.meta.dir, "..", "..", "..", "..");
}

function readJsonSafe<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function loadMicrofrontendsFromConfig(projectRoot: string): string[] {
  const configPath =
    process.env.CONFIG_PATH ||
    process.env.CONVERGED_CONFIG_PATH ||
    resolve(projectRoot, "config.json");

  if (!existsSync(configPath)) return [];

  const cfg = readJsonSafe<ProjectConfig>(configPath);
  const list = Array.isArray(cfg?.spa?.microfrontends) ? cfg!.spa!.microfrontends! : [];
  const fromCurrent = list.map(ensureMfPrefix);

  if (!cfg?.extends || typeof cfg.extends !== "string") {
    return fromCurrent;
  }

  const parentRoot = resolve(projectRoot, "..", cfg.extends);
  const parentConfigPath = resolve(parentRoot, "config.json");
  if (!existsSync(parentConfigPath)) {
    return fromCurrent;
  }

  const parentCfg = readJsonSafe<ProjectConfig>(parentConfigPath);
  const parentList = Array.isArray(parentCfg?.spa?.microfrontends)
    ? parentCfg!.spa!.microfrontends!.map(ensureMfPrefix)
    : [];

  return uniq([...parentList, ...fromCurrent]);
}

function loadMicrofrontendsFromFs(projectRoot: string): string[] {
  const mfRoot = resolve(projectRoot, "front", "microfrontends");
  if (!existsSync(mfRoot)) return [];

  const direct = readdirSync(mfRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("mf-"))
    .map((entry) => entry.name);

  const grouped = readdirSync(mfRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((group) => {
      const groupPath = resolve(mfRoot, group.name);
      return readdirSync(groupPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("mf-"))
        .map((entry) => entry.name);
    });

  return uniq([...direct, ...grouped]);
}

function loadMicrofrontendsFromDist(projectRoot: string): string[] {
  const distMfRoot = resolve(projectRoot, "dist", "mf");
  if (!existsSync(distMfRoot)) return [];

  return readdirSync(distMfRoot)
    .filter((name) => name.startsWith("mf-") && name.endsWith(".js"))
    .map((name) => name.replace(/\.js$/, ""));
}

function loadExternalPackages(projectRoot: string): string[] {
  const importMapCandidates = [
    resolve(projectRoot, "dist", "front", "import-map.json"),
    resolve(projectRoot, "front", "front-core", "dist", "import-map.json"),
  ];

  for (const importMapPath of importMapCandidates) {
    if (!existsSync(importMapPath)) continue;
    const importMap = readJsonSafe<ImportMapFile>(importMapPath);
    const fromImportMap = Object.keys(importMap?.imports ?? {});
    return uniq([...defaultSharedPackages, ...fromImportMap]);
  }

  return defaultSharedPackages;
}

const projectRoot = resolveProjectRoot();

let _microfrontends: string[] | null = null;

function resolveMicrofrontends(): string[] {
  const parentProjectRoot = process.env.CHILD_PROJECT_DIR || undefined;
  const projectRoots = parentProjectRoot ? [projectRoot, parentProjectRoot] : [projectRoot];

  const envMicrofrontends = parseEnvList(process.env.MICROFRONTENDS).map(ensureMfPrefix);
  const configMicrofrontends = uniq(projectRoots.flatMap(loadMicrofrontendsFromConfig));
  const fsMicrofrontends = uniq(projectRoots.flatMap(loadMicrofrontendsFromFs));
  const distMicrofrontends = uniq(projectRoots.flatMap(loadMicrofrontendsFromDist));
  const isProduction = process.env.NODE_ENV === "production";
  const discoveredMicrofrontends = isProduction
    ? uniq([
        ...configMicrofrontends,
        ...fsMicrofrontends,
        ...distMicrofrontends,
      ])
    : fsMicrofrontends.length > 0
      ? fsMicrofrontends
      : uniq([
          ...configMicrofrontends,
          ...distMicrofrontends,
        ]);

  return uniq(
    envMicrofrontends.length > 0
      ? envMicrofrontends
      : discoveredMicrofrontends,
  );
}

export const microfrontends: string[] = new Proxy([] as string[], {
  get(_, prop) {
    if (_microfrontends === null) _microfrontends = resolveMicrofrontends();
    return Reflect.get(_microfrontends, prop);
  },
});

export const externalPackages = loadExternalPackages(projectRoot);
