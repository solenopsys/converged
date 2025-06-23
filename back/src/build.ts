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
  "@elysiajs/cors",
  "openai",
  "bcryptjs",
  "@elysiajs/jwt"
];

mkdirSync("dist", { recursive: true });

 


/*──────────── 3. основной бандл приложения ───────────────*/
await Bun.build({
  entrypoints: ["./src/api.ts"],
  outdir: "./dist",
  format: "esm",
  minify: true, 
  target: "node",
});


await Bun.build({
  entrypoints: ["./src/services.ts"],
  outdir: "./dist",
  format: "esm",
  minify: true, 
  target: "node",
});


console.log(`📦 api.js - ${size("dist/api.js")}`);
console.log(`📦 services.js - ${size("dist/services.js")}`);

/*──────────── 4. бандлы модулей из src/modules ───────────*/
const modulesDir = "./services";
for (const dirent of readdirSync(modulesDir, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const name = dirent.name;
  const entry = join(modulesDir, name, "src/index.ts");
  console.log(entry);
  const outName = `/services/${name}.js`;
  const outPath = join("dist", outName);

  try {
    await Bun.build({
      entrypoints: [entry],
      outdir: "./dist",
      naming: outName, 
      minify: true, 
      target: "node",
      external: externalPkgs 
    });
    console.log(`🧩 ${outName} - ${size(outPath)}`);
  } catch (e: any) {
    console.warn(`⚠️  Module ${name} skipped: ${e.message}`);
  }
}


 




console.log("✅ Build complete");