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
  "elysia",
  "kysely",
  "jsonpath-plus",
  "@mozilla/readability",
  "marked"
];

mkdirSync("dist", { recursive: true });

 


/*──────────── 3. основной бандл приложения ───────────────*/
await Bun.build({
  entrypoints: ["./src/server/index.ts"],
  outdir: "./dist",
  format: "esm",
  minify: true, 
  target: "node",
  external: externalPkgs
});


console.log(`📦 index.js - ${size("dist/index.js")}`);

/*──────────── 4. бандлы модулей из src/modules ───────────*/
const modulesDir = "./src/nodes";
for (const dirent of readdirSync(modulesDir, { withFileTypes: true })) {

 
  if (dirent.isDirectory()) continue;
  const name = dirent.name;

  const entry = join(modulesDir, name);

 const mName=name.replace(".ts", "");

 // console.log(entry);
  const outName = `/nodes/${mName}.js`;
  const outPath = join("dist", outName);

  try {
    await Bun.build({
      entrypoints: [entry],
      outdir: "./dist",
      naming: outName,
      format: "esm",
      minify: true, 
      target: "browser",
      external: externalPkgs
    });
    console.log(`🧩 ${outName} - ${size(outPath)}`);
  } catch (e: any) {
    console.warn(`⚠️  Module ${name} skipped: ${e.message}`);
  }
}

 




console.log("✅ Build complete");