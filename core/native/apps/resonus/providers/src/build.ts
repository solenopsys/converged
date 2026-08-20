/**
 * The descriptor builder.
 *
 * Takes the TypeScript descriptors in `src/providers` and emits what the Zig
 * core loads. The split in the output mirrors the split in the contract:
 *
 *   dist/<name>.table.json  the decode table and transport — pure data, read
 *                           once at startup and executed by the core
 *   dist/hooks.js           every warm hook from every provider, bundled into
 *                           one script the core evaluates into a QuickJS
 *                           runtime; functions are reachable as
 *                           `globalThis["<provider>__<hook>"]`
 *   dist/manifest.json      the provider index with content hashes
 *
 * Validation runs before anything is written. A descriptor that would not load
 * fails the build instead of failing a deployment.
 *
 * Usage:
 *   bun run src/build.ts <outDir>    build
 *   bun run src/build.ts --check     validate only, write nothing
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { Descriptor } from "./schema.ts";
import { DescriptorError, validate } from "./validate.ts";

const PROVIDERS_DIR = resolve(import.meta.dir, "providers");

/** `anthropic.ts` -> `anthropic.hooks.ts`: logic lives beside its descriptor. */
function hooksPathOf(file: string): string {
	return join(PROVIDERS_DIR, `${basename(file, ".ts")}.hooks.ts`);
}

interface Loaded {
	file: string;
	descriptor: Descriptor;
	hookNames: string[];
}

async function loadAll(): Promise<Loaded[]> {
	const entries = (await readdir(PROVIDERS_DIR))
		.filter(
			(f) =>
				f.endsWith(".ts") &&
				!f.endsWith(".test.ts") &&
				!f.endsWith(".hooks.ts"),
		)
		.sort();

	const loaded: Loaded[] = [];
	for (const file of entries) {
		const expectedName = basename(file, ".ts");
		const module = (await import(join(PROVIDERS_DIR, file))) as {
			default?: Descriptor;
		};
		const descriptor = module.default;
		if (!descriptor) {
			throw new DescriptorError(
				expectedName,
				"module",
				"has no default export",
			);
		}
		validate(descriptor, expectedName);
		loaded.push({
			file,
			descriptor,
			hookNames: Object.keys(descriptor.hooks ?? {}).sort(),
		});
	}
	if (loaded.length === 0)
		throw new Error("no descriptors found in src/providers");
	return loaded;
}

/** The data half: everything the core executes without calling JS. */
function tableOf(d: Descriptor, hookNames: string[]): unknown {
	return {
		apiVersion: d.apiVersion,
		name: d.name,
		transport: d.transport,
		signaling: d.signaling,
		decode: d.decode,
		// Names only. The implementations live in the bundle; listing them here
		// lets the core verify at load time that every hook it may call exists,
		// instead of discovering a missing one mid-turn.
		hooks: hookNames,
	};
}

/**
 * Entry module for the hook bundle.
 *
 * Imports the `hooks` export only — never the descriptor. The descriptor's
 * transport and decode table are already emitted as JSON and executed by the
 * core; pulling them into the bundle too would ship the same data twice and put
 * it somewhere it is never read. What reaches QuickJS is business logic and
 * nothing else.
 *
 * Every hook is wrapped in one uniform ABI: a single JSON-array argument in, a
 * JSON string out. The wrapper — not each hook — owns that encoding, so a hook
 * stays ordinary TypeScript and the core never has to know which of them
 * happens to return a string.
 */
function entrySource(loaded: Loaded[]): string {
	const imports = loaded
		.map(
			(l, i) =>
				`import { hooks as h${i} } from ${JSON.stringify(hooksPathOf(l.file))};`,
		)
		.join("\n");
	const registrations = loaded
		.map((l, i) => `\t[${JSON.stringify(l.descriptor.name)}, h${i}],`)
		.join("\n");

	return `${imports}

const registry = [
${registrations}
];

for (const [name, hooks] of registry) {
	for (const hook of Object.keys(hooks)) {
		const impl = hooks[hook];
		globalThis[name + "__" + hook] = (argsJson) => {
			const args = argsJson ? JSON.parse(argsJson) : [];
			return JSON.stringify(impl(...args));
		};
	}
}
`;
}

async function buildHooks(loaded: Loaded[], outDir: string): Promise<string> {
	const entryPath = join(outDir, ".entry.js");
	await writeFile(entryPath, entrySource(loaded), "utf8");

	const result = await Bun.build({
		entrypoints: [entryPath],
		// QuickJS has no module loader and the core evaluates the script into a
		// global scope, so the bundle must be a self-contained IIFE with no
		// import/export left in it.
		format: "iife",
		target: "browser",
		minify: false,
		sourcemap: "none",
	});

	await rm(entryPath, { force: true });

	if (!result.success) {
		const details = result.logs.map((l) => String(l)).join("\n");
		throw new Error(`hook bundle failed:\n${details}`);
	}
	const [artifact] = result.outputs;
	if (!artifact) throw new Error("hook bundle produced no output");
	return await artifact.text();
}

function sha256(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const checkOnly = args.includes("--check");
	const outArg = args.find((a) => !a.startsWith("--"));

	const loaded = await loadAll();

	for (const l of loaded) {
		const hooks = l.hookNames.length > 0 ? l.hookNames.join(", ") : "none";
		console.log(
			`ok  ${l.descriptor.name.padEnd(18)} ${l.descriptor.transport.kind.padEnd(6)} hooks: ${hooks}`,
		);
	}

	if (checkOnly) {
		console.log(`\n${loaded.length} descriptor(s) valid`);
		return;
	}

	const outDir = resolve(outArg ?? "dist");
	await mkdir(outDir, { recursive: true });

	const manifest: Record<string, unknown>[] = [];
	for (const l of loaded) {
		const text = `${JSON.stringify(tableOf(l.descriptor, l.hookNames), null, "\t")}\n`;
		const file = `${l.descriptor.name}.table.json`;
		await writeFile(join(outDir, file), text, "utf8");
		manifest.push({
			name: l.descriptor.name,
			table: file,
			transport: l.descriptor.transport.kind,
			stateful: l.descriptor.transport.stateful,
			hooks: l.hookNames,
			sha256: sha256(text),
		});
	}

	const bundle = await buildHooks(loaded, outDir);
	await writeFile(join(outDir, "hooks.js"), bundle, "utf8");

	const manifestText = `${JSON.stringify(
		{
			apiVersion: loaded[0]?.descriptor.apiVersion,
			hooks: { file: "hooks.js", sha256: sha256(bundle) },
			providers: manifest,
		},
		null,
		"\t",
	)}\n`;
	await writeFile(join(outDir, "manifest.json"), manifestText, "utf8");

	console.log(
		`\nwrote ${loaded.length} table(s) + hooks.js (${bundle.length} bytes) to ${outDir}`,
	);
}

main().catch((err: unknown) => {
	console.error(err instanceof DescriptorError ? err.message : err);
	process.exit(1);
});
