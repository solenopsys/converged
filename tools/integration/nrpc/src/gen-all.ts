#!/usr/bin/env bun
import { readdirSync } from "fs";
import { resolve, join, relative } from "path";
import { spawnSync } from "bun";

const typesDir = process.argv[2];
const generatedDir = process.argv[3];

if (!typesDir || !generatedDir) {
  console.error("Usage: gen-all <types-dir> <gen-parent-dir>");
  console.error(
    "Example: gen-all /abs/path/to/types /abs/path/to/integration/generated",
  );
  process.exit(1);
}

const TYPES_DIR = resolve(process.cwd(), typesDir);
const GENERATED_DIR = resolve(process.cwd(), generatedDir);
const GENERATOR_PATH = resolve(import.meta.dir, "generator.ts");

console.log(`📂 Scanning types directory: ${TYPES_DIR}`);
console.log(`📁 Output directory: ${GENERATED_DIR}`);
console.log("");

function collectTypeFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    if (entry.name.startsWith("_")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeFiles(path));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

const files = collectTypeFiles(TYPES_DIR);

if (files.length === 0) {
  console.log("⚠️  No .ts files found in types directory");
  process.exit(0);
}

console.log(`Found ${files.length} type file(s):\n`);

function derivePackageName(relPath: string): string {
  const parts = relPath.replace(/\.ts$/, "").split("/");
  const fileName = parts[parts.length - 1];
  const prefixMap: Record<string, string> = { runtime: "rt" };
  const prefix = prefixMap[parts[0]];
  return prefix ? `g-${prefix}-${fileName}` : `g-${fileName}`;
}

const plans = files.map((file) => {
  const name = relative(TYPES_DIR, file).replaceAll("\\", "/").replace(/\.ts$/, "");
  const packageName = derivePackageName(relative(TYPES_DIR, file).replaceAll("\\", "/"));
  return { file, name, packageName };
});

const packages = new Map<string, string[]>();
for (const plan of plans) {
  const list = packages.get(plan.packageName) ?? [];
  list.push(plan.name);
  packages.set(plan.packageName, list);
}

const collisions = Array.from(packages.entries()).filter(([, names]) => names.length > 1);
if (collisions.length > 0) {
  console.error("❌ Generated package name collision(s):");
  for (const [packageName, names] of collisions) {
    console.error(`  ${packageName}: ${names.join(", ")}`);
  }
  console.error("Rename the colliding type files or move them to different directories.");
  process.exit(1);
}

let successCount = 0;
let errorCount = 0;

for (const plan of plans) {
  console.log(`🔧 Generating from ${plan.name}...`);

  const result = spawnSync(
    ["bun", "run", GENERATOR_PATH, plan.file, GENERATED_DIR, TYPES_DIR],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  if (result.exitCode === 0) {
    successCount++;
  } else {
    errorCount++;
    console.error(`❌ Failed to generate from ${plan.file}`);
  }
}

console.log("");
console.log("━".repeat(40));
console.log(`✅ Success: ${successCount}`);
if (errorCount > 0) {
  console.log(`❌ Errors: ${errorCount}`);
}
console.log("━".repeat(40));

process.exit(errorCount > 0 ? 1 : 0);
