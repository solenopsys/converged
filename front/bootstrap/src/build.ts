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


await $`rm -f dist/index.css`;

/*──────────── 2. Основной бандл приложения ───────────────*/
await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  format: "esm",
  minify: false,
 // sourcemap: false,
  sourcemap: "linked",
  target: "browser",
  importmap: "./import-map.json",
  external: ["converged-core","react","react-dom","react-router-dom"],
  jsx: "automatic",
  tsconfig: "./tsconfig.json"
});
console.log(`📦 main.js - ${size("dist/main.js")}`);




/*──────────── 3. Модифицируем HTML с import map ─────────*/
const htmlContent = await Bun.file("confs/index.html").text();

const importMap = await Bun.file("../core/dist/import-map.json").json();
importMap.imports["converged-core"] = "/core.js";

const rewriter = new HTMLRewriter().on("head", {
  element(element) {
    element.prepend(
      `<script type=\"importmap\">\n${JSON.stringify(importMap, null, 2)}\n</script>\n`, 
      { html: true }
    );
  }
});

const modifiedHtml = rewriter.transform(new Response(htmlContent));
await Bun.write("dist/index.html", await modifiedHtml.text());
console.log(`📄 index.html - ${size("dist/index.html")} (with import map)`);

/*──────────── 4. Копируем остальную статику ─────────────*/
await $`cp -r confs/assets dist/assets 2>/dev/null || true`;
await $`cp -r  ../locales dist/locales 2>/dev/null || true`;
await $`cp confs/modules.json dist/modules.json`;
await $`cp ../core/dist/index.js dist/core.js`;
await $`cp ../core/dist/index.css dist/index.css`;


await $`bunx @tailwindcss/cli -i ./src/main.css -o ./dist/main.css`;
console.log("✅ Build complete");