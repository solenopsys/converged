// build.ts — последовательно выполнить `bun bld` в каждом ./packages/<pkg>
import { $ } from "bun";
import { readdirSync } from "fs";
import { join } from "path";

const PACKAGES_DIR = "./packages";

for (const dirent of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;

  const pkgName = dirent.name;
  const cwd = join(PACKAGES_DIR, pkgName);

  console.log(`\n▶️  ${pkgName}: bun bld`);
  try {
    // Самая совместимая форма: зайти в директорию и собрать
    await $`bash -lc "cd ${cwd} && bun bld"`;
    console.log(`✅ ${pkgName}: done`);
  } catch (e) {
    console.error(`❌ ${pkgName}: build failed`);
    console.error(e);
    // Если нужно падать сразу — раскомментируй:
    // process.exit(1);
  }
}
