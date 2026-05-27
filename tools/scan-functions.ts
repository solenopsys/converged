#!/usr/bin/env bun
/**
 * Scans microfrontend source files and extracts UIAction definitions
 * into a commands-catalog.json for pushing to ms-functions.
 *
 * Usage:
 *   bun tools/scan-functions.ts [--mf-dir=./front/microfrontends] [--out=./commands-catalog.json]
 *
 * For club-portal (child project):
 *   bun tools/scan-functions.ts \
 *     --mf-dir=./front/microfrontends \
 *     --mf-dir=/path/to/converged-portal/front/microfrontends \
 *     --out=./commands-catalog.json
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import type { FunctionInput } from "g-functions";

const args = process.argv.slice(2);
const mfDirs: string[] = [];
let outPath = "./commands-catalog.json";

for (const arg of args) {
  if (arg.startsWith("--mf-dir=")) mfDirs.push(arg.slice("--mf-dir=".length));
  else if (arg.startsWith("--out=")) outPath = arg.slice("--out=".length);
}

if (mfDirs.length === 0) {
  mfDirs.push("./front/microfrontends");
}

// Extract string literal value from source after a key like `id:`, `brief:`, `category:`
function extractStringAfterKey(source: string, key: string): string | undefined {
  const pattern = new RegExp(`\\b${key}\\s*:\\s*(['"\`])([^'"\`\\n]+)\\1`, "m");
  const match = pattern.exec(source);
  return match?.[2];
}

// Resolve constant references: if id uses a variable like SHOW_SOMETHING, find its value
function resolveConstants(source: string): Map<string, string> {
  const map = new Map<string, string>();
  // Match: const SOME_CONST = "some.value";  or  const SOME_CONST = 'some.value';
  const pattern = /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*(['"])([^'"]+)\2/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    map.set(match[1], match[3]);
  }
  return pattern.lastIndex, map;
}

function extractActionsFromSource(source: string, filePath: string): FunctionInput[] {
  const constants = resolveConstants(source);
  const results: FunctionInput[] = [];

  // Find all CreateAction factory blocks — look for objects with `id:` and `brief:` or `description:`
  // Pattern: find action objects { id: ..., brief: ..., description: ..., category: ..., invoke: }
  const blockPattern = /\{[\s\S]*?\bid\s*:\s*(?:(['"`])([^'"`\n]+)\1|([A-Z_][A-Z0-9_]*))[,\s][\s\S]*?invoke\s*:/g;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(source)) !== null) {
    const block = match[0];

    // Resolve id — either a literal or a constant reference
    let id: string | undefined;
    const literalId = match[2];
    const constRef = match[3];
    if (literalId) {
      id = literalId;
    } else if (constRef) {
      id = constants.get(constRef);
    }

    if (!id || !id.includes(".")) continue; // Only dotted IDs like "mailing.outgoing.show"

    const brief = extractStringAfterKey(block, "brief");
    const description = extractStringAfterKey(block, "description");
    const category = extractStringAfterKey(block, "category");

    if (!brief && !description) continue;

    results.push({
      id,
      brief: brief ?? description ?? "",
      description: description ?? brief ?? "",
      category,
      type: "front",
    });
  }

  return results;
}

function scanDirectory(dir: string): FunctionInput[] {
  const results: FunctionInput[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDirectory(fullPath));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.includes(".test.") &&
      !entry.name.includes(".spec.")
    ) {
      try {
        const source = readFileSync(fullPath, "utf8");
        // Only process files that look like action/function definitions
        if (!source.includes("CreateAction") && !source.includes("invoke:")) continue;
        const found = extractActionsFromSource(source, fullPath);
        if (found.length > 0) {
          console.log(`  ${relative(process.cwd(), fullPath)}: ${found.length} action(s)`);
          results.push(...found);
        }
      } catch {
        // Ignore unreadable files
      }
    }
  }

  return results;
}

// Deduplicate by id, later entries (child project) override earlier (parent)
function dedupe(functions: FunctionInput[]): FunctionInput[] {
  const map = new Map<string, FunctionInput>();
  for (const fn of functions) {
    map.set(fn.id, fn);
  }
  return Array.from(map.values());
}

console.log("Scanning microfrontend sources…\n");
const allFunctions: FunctionInput[] = [];

for (const dir of mfDirs) {
  const absDir = resolve(dir);
  console.log(`📁 ${absDir}`);
  allFunctions.push(...scanDirectory(absDir));
}

const catalog = dedupe(allFunctions);
const absOut = resolve(outPath);
writeFileSync(absOut, JSON.stringify(catalog, null, 2));

console.log(`\n✅ Found ${catalog.length} unique functions → ${absOut}`);
console.log("\nNext: push to ms-functions via CLI:");
console.log(`  bun cli functions push --catalog=${outPath}`);
