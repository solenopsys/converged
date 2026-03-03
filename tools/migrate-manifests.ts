/**
 * migrate-manifests — fixes dataLocation paths in manifest.json files
 *
 * Fixes two broken formats:
 *   ../../data/{ms}/{store}/data.ext  →  data/{ms}/{store}/data.ext
 *   /absolute/path/data/{ms}/{store}/data.ext  →  data/{ms}/{store}/data.ext
 *
 * Usage:
 *   bun run migrate-manifests
 *   DATA_DIR=/custom/path bun run migrate-manifests
 */

import { readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const dataDir = process.env.DATA_DIR ?? "/home/alexstorm/distrib/4ir/gestalt/clarity/data";

interface Manifest {
  name: string;
  dataLocation: string;
  version: string;
  type: string;
  migrations: string[];
}

function fixDataLocation(loc: string, ms: string, store: string): string | null {
  const ext = loc.match(/\.(db|lmdb)$/) ? loc.match(/\.(db|lmdb)$/)![0] : "";
  const suffix = loc.endsWith("/data") || (!ext) ? "/data" : `/data${ext}`;

  // Already correct
  if (loc.startsWith("data/")) return null;

  // Pattern: ../../data/{ms}/{store}/data.ext
  const relMatch = loc.match(/^(?:\.\.\/)+data\/(.+)$/);
  if (relMatch) return `data/${relMatch[1]}`;

  // Pattern: /absolute/.../data/{ms}/{store}/data.ext
  // Find the "data/{ms}/{store}" part
  const absMatch = loc.match(/\/data\/([^/]+\/[^/]+\/[^/]+)$/);
  if (absMatch) return `data/${absMatch[1]}`;

  // Fallback: reconstruct canonical path
  return `data/${ms}/${store}${suffix}`;
}

let fixed = 0;
let skipped = 0;
let errors = 0;

for (const ms of readdirSync(dataDir, { withFileTypes: true })) {
  if (!ms.isDirectory()) continue;
  const msPath = join(dataDir, ms.name);

  for (const store of readdirSync(msPath, { withFileTypes: true })) {
    if (!store.isDirectory()) continue;
    const manifestPath = join(msPath, store.name, "manifest.json");
    if (!existsSync(manifestPath)) continue;

    let manifest: Manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (e) {
      console.error(`✗ parse error ${ms.name}/${store.name}: ${e}`);
      errors++;
      continue;
    }

    const newLoc = fixDataLocation(manifest.dataLocation, ms.name, store.name);
    if (!newLoc) {
      console.log(`  ok  ${ms.name}/${store.name}: ${manifest.dataLocation}`);
      skipped++;
      continue;
    }

    const updated: Manifest = { ...manifest, dataLocation: newLoc };
    try {
      writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
      console.log(`  fix ${ms.name}/${store.name}: ${manifest.dataLocation} → ${newLoc}`);
      fixed++;
    } catch (e) {
      console.error(`✗ write error ${ms.name}/${store.name}: ${e}`);
      errors++;
    }
  }
}

console.log(`\nDone: ${fixed} fixed, ${skipped} ok, ${errors} errors`);
