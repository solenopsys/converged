
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

  async function publicMouduleToS3(fileName: string) {
    console.log(`Uploading ${fileName} to S3...`);
    try {
        // Добавляем await для ожидания завершения команды
        await $`aws s3 cp ./dist${fileName} s3://converged-modules/back${fileName} `;
        console.log(`✅ ${fileName} uploaded successfully`);
    } catch (error) {
        console.error(`❌ Failed to upload ${fileName}:`, error);
        throw error; // Перебрасываем ошибку, чтобы можно было обработать выше
    }
}  

/*──────────── 4. бандлы модулей из src/modules ───────────*/
const modulesDir = "./packages";
for (const dirent of readdirSync(modulesDir, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const name = dirent.name;
  const entry = join(modulesDir, name, "src/index.ts");


  console.log(entry);
  const outName = `/${name}.js`;
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
    console.log(e);
  }
  
  // Загружаем в S3 только после успешной сборки
  await publicMouduleToS3(outName);
}


 