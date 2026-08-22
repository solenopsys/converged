#!/usr/bin/env bun

/**
 * Builds every module in the tree into the content-addressed registry.
 *
 *   bun run build:modules        # build into dist/registry
 *   bun run build:modules -p     # …and publish to the registry bucket
 *
 * The images used to carry the modules. They no longer do: a Solution names
 * modules, ptah maps those names to digests, and a container fetches the bytes
 * by digest through ptah. This script produces exactly those two things — the
 * bytes, and the mapping.
 *
 * Output layout under `--out` (default `dist/registry`):
 *
 *   objects/<sha256>     one file per module, no extension, no directories
 *   modules.json         { revision, modules: { "ms-orders.js": "<sha256>" } }
 *
 * The flat digest-named directory is not a style choice: it is byte-for-byte
 * what ptah's cache holds (`core/native/apps/ptah/src/module_cache.zig`), so
 * publishing is a copy and a cache miss is a `GET <registry>/<digest>`.
 *
 * `modules.json` is the whole of the naming layer. Names, kinds and versions
 * live there and nowhere else; the storage has no opinion about them, which is
 * the point of keeping the two apart. Its own digest is the `revision` — ptah
 * folds that into the rollout digest, so publishing new content restarts the
 * pods that would otherwise never observe it.
 *
 * A module carries its own code and nothing the base already has. One artifact
 * cannot share a chunk with another — a split chunk would need a name, and
 * naming is what this layout removes — so anything bundled twice is bundled
 * once per module. `back-core` alone is 216 KiB; left in, 48 microservices cost
 * 10 MiB of the same bytes instead of the 0.44 MiB they actually are. The base
 * externals below are therefore not an optimisation but the thing that makes
 * per-module artifacts viable at all.
 *
 * Artifacts ship brotli-compressed. The digest is taken over the compressed
 * bytes, because those are the bytes that travel and the bytes ptah stores —
 * hashing anything else would give the cache something to verify that is not
 * what it holds.
 */

import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { brotliCompressSync, constants as zlib } from "node:zlib";
import { FUNCTION_INDEX } from "back-core/module-registry";
import { createGenerator } from "unocss";
import { createImportMap } from "../../../frontend/spa/src/import-map";
import unoMicrofrontendConfig from "../../../frontend/spa/uno.mf.config";
import { createCssPlugin, withStylePrologue } from "./css";
import { discover, type Kind, type Module } from "./discover";

type Options = {
	/** Converged checkout — the base layer. */
	projectDir: string;
	/** Product checkout when one extends converged, else undefined. */
	childProjectDir?: string;
	outDir: string;
	publish: boolean;
	/** Build only these kinds; empty means all three. */
	kinds: Kind[];
};

const ALL_KINDS: Kind[] = ["microservices", "microfrontends", "workflows"];

function parseArgs(argv: string[]): Options {
	const values = new Map<string, string>();
	let publish = false;
	for (const arg of argv) {
		if (arg === "-p" || arg === "--publish") {
			publish = true;
			continue;
		}
		const match = /^--([^=]+)=(.*)$/.exec(arg);
		if (match) values.set(match[1], match[2]);
	}

	// Run from anywhere: the default is this file's own checkout, not the cwd.
	const projectDir = resolve(
		values.get("project-dir") ?? resolve(import.meta.dir, "../../../.."),
	);
	const childProjectDir = values.get("child-project-dir")?.trim();
	const kinds = (values.get("kind")?.split(",") ?? [])
		.map((kind) => kind.trim())
		.filter(Boolean) as Kind[];
	for (const kind of kinds) {
		if (!ALL_KINDS.includes(kind)) {
			throw new Error(
				`--kind: unknown "${kind}", expected ${ALL_KINDS.join("|")}`,
			);
		}
	}

	return {
		projectDir,
		childProjectDir:
			childProjectDir && resolve(childProjectDir) !== projectDir
				? resolve(childProjectDir)
				: undefined,
		outDir: resolve(values.get("out") ?? join(projectDir, "dist/registry")),
		publish,
		kinds: kinds.length > 0 ? kinds : ALL_KINDS,
	};
}

/**
 * Everything the import map already links is `external` for a microfrontend —
 * preact, effector, front-core, the transport. A second copy of any of them on
 * the page is a second function catalogue and a second socket, so a module that
 * bundled one would break the page it was loaded into rather than just be
 * larger. Other microfrontends are external for the same reason.
 */
function frontendExternals(names: string[]): string[] {
	return Object.keys(createImportMap(names).imports);
}

/**
 * What the ms base image already holds, and what a module must therefore not
 * carry. Two separate reasons, and both are correctness rather than size:
 *
 * `back-core` and `nrpc` are the server the module plugs into. A bundled copy
 * would be a second instance of the service registry, the transport and the
 * request context — the module would register itself into a registry the server
 * never reads. The image hands out its own instances instead; see
 * `core/backend/src/base-modules.ts`.
 *
 * `sharp` and `lightningcss` load prebuilt native binaries. A bundled copy
 * cannot find them, and only fails at the first call.
 *
 * Everything else a module imports is its own: `openai`, `@aws-sdk/client-ses`
 * and their like belong to the one module that uses them and travel with it,
 * which is exactly what keeps them out of the base image.
 */
const BASE_EXTERNALS = [
	"back-core",
	"back-core/*",
	"nrpc",
	"nrpc/*",
	"sharp",
	"lightningcss",
];

/**
 * A microservice is two sources — the implementation and its generated nrpc
 * metadata — and one registry object, because a digest names one file. This
 * entry is what joins them; the runtime loader reads both names off it.
 */
async function writeServiceEntry(
	options: Options,
	module: Module,
): Promise<string> {
	const source = `// Generated by core/tools/registry/src/build.ts — do not edit.
export { default as implementation } from ${JSON.stringify(module.implementation)};
export { metadata } from ${JSON.stringify(module.metadata)};
`;
	const path = join(options.outDir, ".entries", `${module.artifact}.ts`);
	await Bun.write(path, source);
	return path;
}

/**
 * The module's own utility layer. Generated over its sources alone, with no
 * preflights: resets and tokens are the base's, and a module that shipped its
 * own copy would restate them on every load. What is left is the handful of
 * classes this module actually uses, which is a few hundred bytes compressed.
 */
async function utilities(module: Module): Promise<string> {
	const sourceDir = dirname(dirname(module.implementation));
	const files = Array.from(
		new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: sourceDir, absolute: true }),
	);
	const sources = (
		await Promise.all(files.map((file) => Bun.file(file).text()))
	).join("\n");
	const uno = await createGenerator(unoMicrofrontendConfig);
	const { css } = await uno.generate(sources, { preflights: false });
	return css;
}

async function bundle(
	options: Options,
	module: Module,
	externals: string[],
): Promise<Uint8Array> {
	const browser = module.kind === "microfrontends";
	const entry =
		module.kind === "microservices"
			? await writeServiceEntry(options, module)
			: module.implementation;

	// Filled by the css plugin as it converts each stylesheet the module imports.
	const styles: string[] = [];
	const result = await Bun.build({
		entrypoints: [entry],
		target: browser ? "browser" : "bun",
		format: "esm",
		minify: true,
		sourcemap: "none",
		// Splitting is impossible here by construction: a shared chunk would be a
		// second file, and a module is addressed by exactly one digest.
		splitting: false,
		external: browser ? externals : BASE_EXTERNALS,
		plugins: browser ? [createCssPlugin(styles)] : [],
	});

	if (!result.success) {
		for (const log of result.logs) console.error(log);
		throw new Error(`[registry] ${module.artifact}: build failed`);
	}

	const scripts = result.outputs.filter(
		(output) => output.kind === "entry-point",
	);
	if (scripts.length !== 1) {
		throw new Error(
			`[registry] ${module.artifact}: expected one entry chunk, got ${scripts.length}`,
		);
	}
	const script = await scripts[0].text();
	if (!browser) return new TextEncoder().encode(script);

	// Utilities last: they exist to override the hand-written component rules,
	// which is the same order the shared layer used.
	return new TextEncoder().encode(
		withStylePrologue(
			script,
			module.name,
			[...styles, await utilities(module)].join("\n"),
		),
	);
}

function sha256(bytes: Uint8Array): string {
	return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

/**
 * Quality 11 — the slow end. These are built once and then fetched by every
 * container of every environment for as long as the digest is current, so the
 * seconds spent here are the only place the trade is not lopsided.
 */
function compress(bytes: Uint8Array): Uint8Array {
	return new Uint8Array(
		brotliCompressSync(bytes, {
			params: {
				[zlib.BROTLI_PARAM_QUALITY]: zlib.BROTLI_MAX_QUALITY,
				[zlib.BROTLI_PARAM_SIZE_HINT]: bytes.byteLength,
			},
		}),
	);
}

type Built = { artifact: string; digest: string; size: number; raw: number };

/**
 * The function catalogue's metadata, as one more registry object.
 *
 * The catalogue is filled by `plug(bus)` when a microfrontend loads, and
 * modules load lazily — so on a fresh page it is empty and the step that picks
 * a function has nothing to show. The index is the compensation: metadata
 * arrives at once, code on demand.
 *
 * It used to be written into the delivery, which worked only while the delivery
 * knew every module. It does not any more, and an index built from the empty
 * set would leave the catalogue permanently blank. So it travels with the
 * modules it describes, and the ui narrows it to the solution when it serves it.
 */
async function buildFunctionIndex(
	options: Options,
	modules: Module[],
): Promise<Uint8Array> {
	// `collectFunctionIndex` reads its module set from the same environment the
	// delivery build uses. Imported dynamically for that reason: the list has to
	// be in place before the layout module computes it.
	process.env.MICROFRONTENDS = modules.map((module) => module.name).join(",");
	process.env.PROJECT_DIR = options.projectDir;
	if (options.childProjectDir) {
		process.env.CHILD_PROJECT_DIR = options.childProjectDir;
	}
	const { collectFunctionIndex } = await import(
		"../../../frontend/spa/src/build/function-index"
	);
	const index = await collectFunctionIndex();
	return new TextEncoder().encode(JSON.stringify(index));
}

async function buildAll(options: Options): Promise<Built[]> {
	const projectDirs = [options.childProjectDir, options.projectDir].filter(
		(value): value is string => Boolean(value),
	);
	const objects = join(options.outDir, "objects");
	mkdirSync(objects, { recursive: true });

	const built: Built[] = [];
	const store = async (artifact: string, script: Uint8Array) => {
		const bytes = compress(script);
		const digest = sha256(bytes);
		await Bun.write(join(objects, digest), bytes);
		built.push({
			artifact,
			digest,
			size: bytes.byteLength,
			raw: script.byteLength,
		});
		console.log(
			`[registry]   ${artifact.padEnd(28)} ${digest.slice(0, 12)}…  ` +
				`${(bytes.byteLength / 1024).toFixed(1)} KiB br (${(script.byteLength / 1024).toFixed(1)} KiB)`,
		);
	};

	for (const kind of options.kinds) {
		const modules = discover(projectDirs, kind);
		if (modules.length === 0) {
			console.warn(
				`[registry] no ${kind} found under ${projectDirs.join(", ")}`,
			);
			continue;
		}
		// Microfrontends may import one another by `mf-<name>`; the names are only
		// known once the whole kind is discovered, so externals are computed here.
		const externals =
			kind === "microfrontends"
				? frontendExternals(modules.map((module) => module.name))
				: [];

		console.log(`[registry] ${kind}: ${modules.length} module(s)`);
		for (const module of modules) {
			await store(module.artifact, await bundle(options, module, externals));
		}
		// Last, and only once every module it describes has been built: the index
		// names modules, so publishing it ahead of them would advertise functions
		// whose code is not in the registry yet.
		if (kind === "microfrontends") {
			await store(FUNCTION_INDEX, await buildFunctionIndex(options, modules));
		}
	}

	rmSync(join(options.outDir, ".entries"), { recursive: true, force: true });
	return built;
}

/**
 * The mapping, in the shape ptah's `spec.registry.modules` takes: a container
 * is handed digests, never names, so this file is the only place a name is
 * resolved and the only thing that has to be edited to roll a module forward.
 */
type Manifest = {
	revision: string;
	/** How every object in this registry is compressed. */
	encoding: "br";
	modules: Record<string, string>;
};

function manifest(built: Built[]): Manifest {
	const modules = Object.fromEntries(
		built
			.map(({ artifact, digest }) => [artifact, digest] as const)
			.sort(([a], [b]) => a.localeCompare(b)),
	);
	// The revision is the mapping's own digest rather than a timestamp: two
	// builds of unchanged sources must not force a rollout.
	const revision = sha256(new TextEncoder().encode(JSON.stringify(modules)));
	return { revision, encoding: "br", modules };
}

type RegistryTarget = {
	client: Bun.S3Client;
	description: string;
};

/**
 * Publishing needs its own bucket and its own credentials. It is not the
 * tenant storage the platform runs on: those objects are customer data with a
 * lifecycle, and these are immutable build output that every environment reads.
 * Sharing one bucket would put a deploy artifact behind a tenant's retention
 * policy.
 */
function registryTarget(): RegistryTarget {
	const required = (name: string): string => {
		const value = process.env[name]?.trim();
		if (!value) {
			throw new Error(`[registry] -p needs ${name} — see confs/registry.env`);
		}
		return value;
	};

	const bucket = required("REGISTRY_S3_BUCKET");
	const endpoint = process.env.REGISTRY_S3_ENDPOINT?.trim() || undefined;
	return {
		client: new Bun.S3Client({
			bucket,
			endpoint,
			region: process.env.REGISTRY_S3_REGION?.trim() || undefined,
			accessKeyId: required("REGISTRY_S3_ACCESS_KEY_ID"),
			secretAccessKey: required("REGISTRY_S3_SECRET_ACCESS_KEY"),
		}),
		description: `${endpoint ?? "s3"}/${bucket}`,
	};
}

function objectKey(digest: string): string {
	const prefix = process.env.REGISTRY_S3_PREFIX?.trim().replace(
		/^\/+|\/+$/g,
		"",
	);
	return prefix ? `${prefix}/${digest}` : digest;
}

async function publish(options: Options, built: Built[], mapping: Manifest) {
	const { client, description } = registryTarget();
	console.log(`[registry] publishing to ${description}`);

	let uploaded = 0;
	for (const { artifact, digest } of built) {
		const object = client.file(objectKey(digest));
		// Entries are immutable — a digest names exactly one sequence of bytes —
		// so a present object is already the right one and re-uploading it would
		// only cost time.
		if (await object.exists()) continue;
		// Stored as opaque octets, not as javascript with `content-encoding: br`.
		// The digest covers the compressed bytes, so any hop that transparently
		// decoded them — S3, the zig client in ptah, `fetch` — would hand the next
		// one something that no longer matches its own digest, and content
		// addressing would fail in the one case it exists to catch. Nothing in the
		// chain decodes what it is not told about; `encoding` in the manifest is
		// what tells the consumer, once, at the end.
		await object.write(Bun.file(join(options.outDir, "objects", digest)), {
			type: "application/octet-stream",
		});
		uploaded += 1;
		console.log(`[registry]   + ${artifact} ${digest.slice(0, 12)}…`);
	}

	// The mapping is the one mutable object in the registry: it is what moves a
	// name from one digest to another. Written last, so it never points at bytes
	// that are not there yet.
	await client
		.file(objectKey("modules.json"))
		.write(JSON.stringify(mapping, null, "\t"), {
			type: "application/json",
		});
	console.log(
		`[registry] published ${uploaded} new object(s), ${built.length - uploaded} already present`,
	);
}

const options = parseArgs(Bun.argv.slice(2));
const built = await buildAll(options);
if (built.length === 0) throw new Error("[registry] nothing was built");

const mapping = manifest(built);
await Bun.write(
	join(options.outDir, "modules.json"),
	`${JSON.stringify(mapping, null, "\t")}\n`,
);
const shipped = built.reduce((sum, entry) => sum + entry.size, 0);
const raw = built.reduce((sum, entry) => sum + entry.raw, 0);
console.log(
	`[registry] ${built.length} module(s) → ${options.outDir}, revision ${mapping.revision.slice(0, 12)}…\n` +
		`[registry] ${(shipped / 1024 / 1024).toFixed(2)} MiB br, ${(raw / 1024 / 1024).toFixed(2)} MiB uncompressed`,
);

if (options.publish) await publish(options, built, mapping);
