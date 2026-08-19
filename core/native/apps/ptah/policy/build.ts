#!/usr/bin/env bun
/**
 * Compile the policy layer into the single classic script that QuickJS
 * evaluates. Two constraints drive the settings below:
 *
 *   - format "iife": QuickJS runs the bundle with JS_EVAL_TYPE_GLOBAL, so
 *     ESM syntax would be a syntax error.
 *   - target "browser": no `process`, `Bun` or node builtins exist inside the
 *     wrapper, and a stray polyfill import would fail at eval time.
 *
 * Usage: bun run build.ts [srcDir] [outFile]
 *
 * The two arguments exist for the Zig build, which passes the source
 * directory so the step is cache-keyed on it, and an output path inside the
 * build cache. Run with no arguments it just refreshes ./dist/policy.js.
 */

import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = import.meta.dir;
const srcDir = Bun.argv[2] ? resolve(Bun.argv[2]) : resolve(root, "src");
const outFile = Bun.argv[3] ? resolve(Bun.argv[3]) : undefined;
const outdir = resolve(root, "dist");

await rm(outdir, { recursive: true, force: true });

const result = await Bun.build({
	entrypoints: [resolve(srcDir, "index.ts")],
	outdir,
	target: "browser",
	format: "iife",
	minify: false,
	naming: "policy.js",
});

if (!result.success) {
	for (const log of result.logs) console.error(log);
	process.exit(1);
}

const bundle = resolve(outdir, "policy.js");
const text = await Bun.file(bundle).text();
if (outFile) await Bun.write(outFile, text);

// The wrapper gives each evaluation a 100 ms budget that has to cover parsing
// the whole bundle. Well before that becomes a real ceiling the right fix is a
// persistent QuickJS context, not a smaller policy — so fail loudly at the
// point where that trade-off actually needs making.
if (text.length > 512 * 1024) {
	console.error(`policy bundle exceeds 512 KiB (${text.length}); QuickJS eval budget is 100 ms`);
	process.exit(1);
}
console.log(`policy.js: ${text.length} bytes`);
