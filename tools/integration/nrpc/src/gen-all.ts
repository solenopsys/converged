#!/usr/bin/env bun
import { readdirSync } from "fs";
import { resolve, join, basename } from "path";
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

const files = readdirSync(TYPES_DIR).filter(
  (file) => file.endsWith(".ts") && !file.startsWith("_"),
);

if (files.length === 0) {
  console.log("⚠️  No .ts files found in types directory");
  process.exit(0);
}

console.log(`Found ${files.length} type file(s):\n`);

let successCount = 0;
let errorCount = 0;

for (const file of files) {
  const typesPath = join(TYPES_DIR, file);
  const name = basename(file, ".ts");

  console.log(`🔧 Generating from ${name}...`);

  const result = spawnSync(
    ["bun", "run", GENERATOR_PATH, typesPath, GENERATED_DIR],
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
    console.error(`❌ Failed to generate from ${file}`);
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
