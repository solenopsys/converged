// build.ts — улучшенная версия с динамической загрузкой версий из package.json
import { $ } from "bun";
import { readdirSync, statSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const size = (p: string) => {
  try {
    return `${(statSync(p).size / 1024).toFixed(1)}kb`;
  } catch {
    return "0kb";
  }
};

// Загружаем package.json для получения версий
let packageVersions: Record<string, string> = {};
try {
  const packageJson = await Bun.file("package.json").json();
  packageVersions = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  console.log(`📦 Loaded ${Object.keys(packageVersions).length} package versions from package.json`);
} catch (error) {
  console.warn("⚠️  Could not load package.json, using fallback versions");
}

/**
 * Получает версию пакета из package.json или возвращает fallback
 */
function getPackageVersion(packageName: string, fallback: string = "latest"): string {
  const version = packageVersions[packageName];
  if (version) return version;
  
  const basePackage = packageName.split('/')[0];
  const version2 = packageVersions[basePackage];
  if (version2) return version2;

  throw new Error(`Package ${packageName} not found in package.json`);
}

// Конфигурация bundle групп с поддержкой standalone режима
const bundleGroups = [
  {
    name: "radix-ui",
    mode: "bundle",
    packages: [
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox", 
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group", 
      "@radix-ui/react-tooltip",
    ],
    deps: ["react", "react-dom"]
  },
  
  {
    name: "dnd-kit",
    mode: "bundle",
    packages: [
      "@dnd-kit/core",
      "@dnd-kit/modifiers",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
    deps: ["react", "react-dom"]
  },
  
  {
    name: "utils",
    mode: "standalone", 
    packages: [
      "tailwind-merge",
      "i18next",
    ],
    deps: []
  },
 
  {
    name: "effector",
    mode: "bundle",
    packages: [ 
      "effector-react",
    ],
    deps: ["react", "react-dom", "effector"]
  },
];

// Список всех пакетов (версии будут загружены из package.json)
const packageList = [
  // Core React packages
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  
  // Routing
  "react-router-dom",
  "react-router-dom/client",
  
  // UI Libraries
  "@tanstack/react-table",
  "recharts",
  "sonner",
  "tailwind-merge",
  
  // Internationalization
  "i18next",
  "react-i18next",
  
  // Radix UI Components
  "@radix-ui/react-avatar",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-collapsible",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-label",
  "@radix-ui/react-select",
  "@radix-ui/react-separator",
  "@radix-ui/react-slot",
  "@radix-ui/react-tabs",
  "@radix-ui/react-toggle",
  "@radix-ui/react-toggle-group",
  "@radix-ui/react-tooltip",
  
  // DnD Kit
  "@dnd-kit/core",
  "@dnd-kit/modifiers",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",

  "zod",
  "vaul",   
  "dagre",
  "i18next-http-backend",

  // effector
  "effector",
  "effector-react",
];

// Группировка пакетов по типу (для статистики)
const packageGroups = {
  core: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  routing: ["react-router-dom", "react-router-dom/client"],
  ui: ["@tanstack/react-table", "recharts", "sonner", "tailwind-merge"],
  i18n: ["i18next", "react-i18next"],
  radix: packageList.filter(pkg => pkg.startsWith("@radix-ui/")),
  dndKit: packageList.filter(pkg => pkg.startsWith("@dnd-kit/")),
  effector: ["effector", "effector-react"],
};

// Пакеты, которые НЕ должны собираться в bundle (runtime пакеты)
const noBundlePackages = [
  "react",
  "react-dom", 
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-router-dom",
  "react-router-dom/client",
  "effector", // только effector, без effector-react
];

// Пакеты, которые должны использовать bundle для оптимизации
const bundlePackages = [
  "@radix-ui/react-avatar",
  "@radix-ui/react-checkbox", 
  "@radix-ui/react-collapsible",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-label",
  "@radix-ui/react-select",
  "@radix-ui/react-separator",
  "@radix-ui/react-slot",
  "@radix-ui/react-tabs",
  "@radix-ui/react-toggle",
  "@radix-ui/react-toggle-group", 
  "@radix-ui/react-tooltip",
  "@dnd-kit/core",
  "@dnd-kit/modifiers",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "@tanstack/react-table",
  "recharts",
  "sonner",
  "vaul",
  "tailwind-merge",
  "react-i18next",
  "i18next",
  "effector-react", // добавлен
];

/**
 * Находит bundle группу для пакета
 */
function findBundleGroup(packageName: string) {
  return bundleGroups.find(group => group.packages.includes(packageName)) || null;
}

/**
 * Создает URL для bundle группы (для справки)
 */
function createBundleGroupUrl(groupName: string, config: { mode: string; packages: string[]; deps?: string[] }): string {
  return `Mode: ${config.mode}, Packages: ${config.packages.length}`;
}

/**
 * Генерирует preload links для критических пакетов
 */
function generatePreloadLinks(): string[] {
  const criticalPackages = [
    "react",
    "react-dom", 
    "react-dom/client",
    "react/jsx-runtime",
    "react/jsx-dev-runtime"
  ];
  
  return criticalPackages.map(pkg => {
    const version = getPackageVersion(pkg);
    if (!version) return '';
    
    const url = generatePackageUrl(pkg, version);
    return `<link rel="modulepreload" href="${url}">`;
  }).filter(Boolean);
}

/**
 * Проверяет, требует ли пакет React зависимости
 */
function requiresReactDeps(packageName: string): boolean {
  // Проверяем bundleGroup.deps
  const bundleGroup = findBundleGroup(packageName);
  if (bundleGroup && bundleGroup.deps.includes("react")) {
    return true;
  }
  
  // Исключаем базовые React пакеты
  if (packageName === "react" || 
      packageName.startsWith("react/") || 
      packageName === "react-dom" ||
      packageName.startsWith("react-dom/")) {
    return false;
  }
  
  // Все что содержит react или известные React-зависимые пакеты
  return packageName.includes("react") || 
         packageName.includes("@tanstack") || 
         packageName.includes("recharts") ||
         packageName.includes("@radix-ui/") ||
         packageName.includes("@dnd-kit/") ||
         packageName === "vaul" ||
         packageName === "sonner";
}

/**
 * Проверяет, должен ли пакет собираться в bundle
 */
function shouldBundle(packageName: string): boolean {
  if (noBundlePackages.includes(packageName)) return false;
  if (bundlePackages.includes(packageName)) return true;
  
  // По умолчанию: runtime пакеты не bundle, остальные - bundle
  return !packageName.includes("react") || packageName.includes("react-");
}

/**
 * Получает основное имя пакета и subpath
 */
function parsePackageName(fullName: string): { packageName: string; subpath?: string } {
  if (fullName.includes('/') && !fullName.startsWith('@')) {
    // Случай react-dom/client
    const [packageName, ...subpathParts] = fullName.split('/');
    return { 
      packageName,
      subpath: subpathParts.join('/') 
    };
  } else if (fullName.startsWith('@') && fullName.split('/').length > 2) {
    // Случай @scope/package/subpath
    const parts = fullName.split('/');
    const packageName = `${parts[0]}/${parts[1]}`;
    const subpath = parts.slice(2).join('/');
    return { packageName, subpath };
  }
  
  return { packageName: fullName };
}

/**
 * Генерирует deps строку для пакета
 */
function generateDepsString(packageName: string): string {
  const bundleGroup = findBundleGroup(packageName);
  
  if (bundleGroup && bundleGroup.deps.length > 0) {
    // Используем deps из bundleGroup
    return bundleGroup.deps.map(dep => {
      const depVersion = getPackageVersion(dep).replace("^", "").replace("~", "");
      return `${dep}@${depVersion}`;
    }).join(",");
  }
  
  // Дефолтные React deps
  if (requiresReactDeps(packageName)) {
    const reactVersion = getPackageVersion("react").replace("^", "").replace("~", "");
    const reactDomVersion = getPackageVersion("react-dom").replace("^", "").replace("~", "");
    return `react@${reactVersion},react-dom@${reactDomVersion}`;
  }
  
  return "";
}

/**
 * Генерирует URL для пакета на ESM.sh с оптимизацией для уменьшения запросов
 */
function generatePackageUrl(name: string, version: string): string {
  const { packageName, subpath } = parsePackageName(name);

  const strongVersion = version.replace("^", "").replace("~", "");
  
  // Строим базовый URL
  let baseUrl = `https://esm.sh/${packageName}@${strongVersion}`;
  if (subpath) {
    baseUrl += `/${subpath}`;
  }
  
  // Проверяем, входит ли пакет в bundle группу со standalone режимом
  const bundleGroup = findBundleGroup(name);
  const useStandalone = bundleGroup?.mode === "standalone";
  
  if (useStandalone) {
    // Standalone включает все зависимости в один файл
    baseUrl += "?standalone";
  } else if (shouldBundle(name)) {
    // Обычный bundle режим
    baseUrl += "?bundle";
    
    // Добавляем зависимости если нужно
    const depsString = generateDepsString(name);
    if (depsString) {
      baseUrl += `&deps=${depsString}`;
    }
  } else {
    // No bundle режим для runtime пакетов
    const depsString = generateDepsString(name);
    if (depsString) {
      baseUrl += `?deps=${depsString}`;
    }
  }
  
  return baseUrl;
}

/**
 * Проверяет, является ли пакет частью bundle группы
 */
function isPartOfBundleGroup(packageName: string): boolean {
  return findBundleGroup(packageName) !== null;
}

/**
 * Генерирует Import Map для ESM.sh
 */
function generateImportMap() {
  const imports: Record<string, string> = {};
  
  for (const packageName of packageList) {
    const version = getPackageVersion(packageName);
    imports[packageName] = generatePackageUrl(packageName, version);
  }
  
  return { imports };
}

/**
 * Получает список внешних пакетов для bundler
 */
function getExternalPackages(): string[] {
  return [...packageList];
}

/**
 * Выводит статистику пакетов
 */
function logPackageStats() {
  console.log("\n📊 Package Statistics:");
  Object.entries(packageGroups).forEach(([group, pkgs]) => {
    console.log(`   ${group}: ${pkgs.length} packages`);
  });
  
  const standaloneCount = bundleGroups
    .filter(config => config.mode === "standalone")
    .reduce((sum, config) => sum + config.packages.length, 0);
    
  const bundledCount = packageList
    .filter(pkg => shouldBundle(pkg) && !isPartOfBundleGroup(pkg)).length;
    
  const noBundleCount = packageList
    .filter(pkg => !shouldBundle(pkg)).length;
  
  console.log(`   Standalone: ${standaloneCount} packages (self-contained)`);
  console.log(`   Bundled: ${bundledCount} packages`);
  console.log(`   No bundle: ${noBundleCount} packages`);
  console.log(`   Total: ${packageList.length} packages\n`);
  
  // Показываем оптимизационные группы
  if (bundleGroups.length > 0) {
    console.log("⚡ Optimization Groups:");
    for (const group of bundleGroups) {
      const modeIcon = group.mode === "standalone" ? "📦" : "🎁";
      console.log(`   ${modeIcon} ${group.name}: ${group.packages.length} packages (${group.mode})`);
    }
    console.log();
  }
}

// Создаем директорию dist
mkdirSync("dist", { recursive: true });

// Выводим статистику
logPackageStats();

/*──────────── 0. Генерация Import Map ────────────────────*/
const importMap = generateImportMap();
writeFileSync("dist/import-map.json", JSON.stringify(importMap, null, 2));
console.log(`📋 import-map.json - ${Object.keys(importMap.imports).length} packages`);

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  format: "esm",
  minify: true,
  sourcemap: "linked",
  target: "browser",
  importmap: "../import-map.json",
  external: getExternalPackages(),
  jsx: "automatic",
  tsconfig: "./tsconfig.json"
});
console.log(`📦 index.js - ${size("dist/index.js")}`);

await $`bunx @tailwindcss/cli -i src/index.css -o ./dist/index.css`;