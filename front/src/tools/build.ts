// build.ts — упрощенная версия с готовыми ESM модулями
import { $ } from "bun";
import { readdirSync, statSync, mkdirSync } from "fs";
import { join } from "path";

const size = (p: string) => {
  try {
    return `${(statSync(p).size / 1024).toFixed(1)}kb`;
  } catch {
    return "0kb";
  }
};

const externalPkgs = [
  "react",
  "react-dom",
  "react-dom/client", 
  "react/jsx-runtime",
  "@tanstack/react-table",
  "recharts",
];

mkdirSync("dist", { recursive: true });

/*──────────── 1. CSS ─────────────────────────────────────*/
await $`bunx postcss-cli src/index.css -o dist/index.css`;
console.log(`📄 index.css - ${size("dist/index.css")}`);

/*──────────── 2. React vendor bundle ────────────────────*/
await Bun.build({
  entrypoints: ["./vendor.ts"], // создадим отдельный файл
  outdir: "./dist",
  format: "esm",
  minify: true,
  treeshaking: false,
  target: "browser",
  splitting: false,
});
console.log(`📦 vendor.js - ${size("dist/vendor.js")}`);

/*──────────── 3. основной бандл приложения ───────────────*/
await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  format: "esm",
  minify: true,
  sourcemap: "linked",
  target: "browser",
  external: externalPkgs,
  jsx: "automatic"
});
console.log(`📦 main.js - ${size("dist/main.js")}`);

/*──────────── 4. бандлы модулей из src/modules ───────────*/
const modulesDir = "./src/modules";
for (const dirent of readdirSync(modulesDir, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const name = dirent.name;
  const entry = join(modulesDir, name, "index.ts");
  const outName = `/modules/${name}.js`;
  const outPath = join("dist", outName);
  
  try {
    await Bun.build({
      entrypoints: [entry],
      outdir: "./dist",
      naming: outName,
      format: "esm",
      minify: true,
      sourcemap: "linked",
      target: "browser",
      external: externalPkgs,
      jsx: "automatic"
    });
    console.log(`🧩 ${outName} - ${size(outPath)}`);
  } catch (e: any) {
    console.warn(`⚠️  Module ${name} skipped: ${e.message}`);
  }
}

/*──────────── 5. копируем статику ────────────────────────*/
await $`cp -r public/* dist/ 2>/dev/null || true`;
await $`cp -r public/assets/* dist/assets/ 2>/dev/null || true`;
await $`cp index.html dist/index.html`;




console.log("✅ Build complete");