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
import { basename, dirname, join, resolve } from "node:path";
import { brotliCompressSync, constants as zlib } from "node:zlib";
import { OBJECT_INDEX } from "back-core/module-registry";
import { createGenerator } from "unocss";
import { buildWorkflow } from "../../../dag/core/build";
import { localizedMicrofrontendEntry } from "../../../frontend/spa/src/build/microfrontend-locales";
import { createImportMap } from "../../../frontend/spa/src/import-map";
import unoMicrofrontendConfig from "../../../frontend/spa/uno.mf.config";
import { createCssPlugin, withStylePrologue } from "./css";
import { discover, type Kind, type Module } from "./discover";
import { LAYERS_PREFIX, type LayerFile, mergeLayers } from "./layers";

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
	if (module.kind === "workflows") {
		return new TextEncoder().encode(await buildWorkflow(module.implementation));
	}
	const entry =
		module.kind === "microservices"
			? await writeServiceEntry(options, module)
			: module.implementation;
	const localizedEntry = browser
		? await localizedMicrofrontendEntry(entry, module.name)
		: null;

	// Filled by the css plugin as it converts each stylesheet the module imports.
	const styles: string[] = [];
	const plugins = localizedEntry
		? [localizedEntry.plugin, createCssPlugin(styles)]
		: [];

	const result = await Bun.build({
		entrypoints: [localizedEntry?.entrypoint ?? entry],
		target: browser ? "browser" : "bun",
		format: "esm",
		minify: true,
		sourcemap: "none",
		// Splitting is impossible here by construction: a shared chunk would be a
		// second file, and a module is addressed by exactly one digest.
		splitting: false,
		external: browser ? externals : BASE_EXTERNALS,
		plugins,
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

type Built = {
	artifact: string;
	digest: string;
	size: number;
	raw: number;
	kind: Kind | "object-index";
};

/**
 * The typed object index, as one more registry object.
 *
 * Modules load lazily, so type, view, and operation manifests travel as a
 * static index while executable definitions arrive with module code.
 *
 * It used to be written into the delivery, which worked only while the delivery
 * knew every module. It does not any more, and an index built from the empty
 * set would leave the catalogue permanently blank. So it travels with the
 * modules it describes, and the ui narrows it to the solution when it serves it.
 */
async function buildObjectIndex(
	options: Options,
	modules: Module[],
): Promise<Uint8Array> {
	// `collectObjectIndex` reads its module set from the same environment the
	// delivery build uses. Imported dynamically for that reason: the list has to
	// be in place before the layout module computes it.
	process.env.MICROFRONTENDS = modules.map((module) => module.name).join(",");
	process.env.PROJECT_DIR = options.projectDir;
	if (options.childProjectDir) {
		process.env.CHILD_PROJECT_DIR = options.childProjectDir;
	}
	const { collectObjectIndex } = await import(
		"../../../frontend/spa/src/build/object-index"
	);
	const index = await collectObjectIndex();
	return new TextEncoder().encode(JSON.stringify(index));
}

async function buildAll(options: Options): Promise<Built[]> {
	const projectDirs = [options.childProjectDir, options.projectDir].filter(
		(value): value is string => Boolean(value),
	);
	const objects = join(options.outDir, "objects");
	mkdirSync(objects, { recursive: true });

	const built: Built[] = [];
	const store = async (
		artifact: string,
		script: Uint8Array,
		kind: Built["kind"],
	) => {
		// Centimanus executes workflow bytes itself. Keeping those sources raw
		// avoids baking a Brotli decoder into the native runtime; ordinary
		// browser/server modules remain compressed.
		const bytes = kind === "workflows" ? script : compress(script);
		const digest = sha256(bytes);
		await Bun.write(join(objects, digest), bytes);
		built.push({
			artifact,
			digest,
			size: bytes.byteLength,
			raw: script.byteLength,
			kind,
		});
		console.log(
			`[registry]   ${artifact.padEnd(28)} ${digest.slice(0, 12)}…  ` +
				`${(bytes.byteLength / 1024).toFixed(1)} KiB ${kind === "workflows" ? "raw" : "br"} (${(script.byteLength / 1024).toFixed(1)} KiB)`,
		);
	};

	for (const kind of options.kinds) {
		const discovered = discover(projectDirs, kind);
		// A product build ships the product's own modules and nothing else.
		// Converged's are converged's to build and publish: rebuilding them from
		// here would produce the same bytes a second time and, worse, a second
		// `modules.json` claiming to be the whole naming layer.
		const modules = options.childProjectDir
			? discovered.filter(
					(module) => module.projectDir === options.childProjectDir,
				)
			: discovered;
		if (modules.length === 0) {
			console.warn(
				`[registry] no ${kind} found under ${
					options.childProjectDir ?? projectDirs.join(", ")
				}`,
			);
			continue;
		}
		// Microfrontends may import one another by `mf-<name>`, across layers as
		// well as within one. The externals are therefore every discovered name,
		// not just the ones being built: a converged microfrontend is resolved
		// through the import map at runtime, so a product module that imports one
		// must reference it, never bundle a second copy of it.
		const externals =
			kind === "microfrontends"
				? frontendExternals(discovered.map((module) => module.name))
				: [];

		console.log(`[registry] ${kind}: ${modules.length} module(s)`);
		for (const module of modules) {
			await store(
				module.artifact,
				await bundle(options, module, externals),
				kind,
			);
		}
		// Last, and only once every module it describes has been built: the index
		// names modules, so publishing it ahead of them would advertise functions
		// whose code is not in the registry yet.
		if (kind === "microfrontends") {
			await store(
				OBJECT_INDEX,
				await buildObjectIndex(options, modules),
				"object-index",
			);
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
	/** Raw workflow source path -> digest. */
	workflows: Record<string, string>;
};

function manifest(
	modules: Record<string, string>,
	workflows: Record<string, string> = {},
): Manifest {
	const sorted = Object.fromEntries(
		Object.entries(modules).sort(([a], [b]) => a.localeCompare(b)),
	);
	// The revision is the mapping's own digest rather than a timestamp: two
	// builds of unchanged sources must not force a rollout.
	const sortedWorkflows = Object.fromEntries(
		Object.entries(workflows).sort(([a], [b]) => a.localeCompare(b)),
	);
	const revision = sha256(
		new TextEncoder().encode(
			JSON.stringify({ modules: sorted, workflows: sortedWorkflows }),
		),
	);
	return {
		revision,
		encoding: "br",
		modules: sorted,
		workflows: sortedWorkflows,
	};
}

/** The layer a build publishes as: the product's name, or converged's. */
function layerName(options: Options): string {
	return basename(options.childProjectDir ?? options.projectDir);
}

/** What it stacks on. A product extends converged; converged extends nothing. */
function layerExtends(options: Options): string[] {
	return options.childProjectDir ? [basename(options.projectDir)] : [];
}

function layerFile(options: Options, built: Built[]): LayerFile {
	return {
		layer: layerName(options),
		extends: layerExtends(options),
		encoding: "br",
		modules: Object.fromEntries(
			built
				.filter(({ kind }) => kind !== "workflows")
				.map(({ artifact, digest }) => [artifact, digest] as const)
				.sort(([a], [b]) => a.localeCompare(b)),
		),
		workflows: Object.fromEntries(
			built
				.filter(({ kind }) => kind === "workflows")
				.map(({ artifact, digest }) => [artifact, digest] as const)
				.sort(([a], [b]) => a.localeCompare(b)),
		),
	};
}

type RegistryTarget = {
	client: Bun.S3Client;
	description: string;
};

function env(...names: string[]): string | undefined {
	for (const name of names) {
		const value = process.env[name]?.trim();
		if (value) return value;
	}
	return undefined;
}

type Credentials = {
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken?: string;
};

/**
 * Whatever the aws cli would use, asked for in the one command that resolves
 * the full chain — profiles, SSO, assumed roles, `~/.aws/credentials`, the
 * instance role — rather than reimplemented here against a subset of it.
 *
 * This is deliberately the same source `release push` authenticates to ECR
 * with (`aws ecr-public get-login-password`, modules/commands/build.ts). An
 * account that can already push the images can push the modules; asking for
 * the keys a second time, in an env file, only creates a second copy to keep
 * current and a second way for the two to disagree.
 */
function awsCliCredentials(): Credentials | undefined {
	const proc = Bun.spawnSync(
		["aws", "configure", "export-credentials", "--format", "process"],
		{ stdout: "pipe", stderr: "pipe" },
	);
	if (!proc.success) return undefined;
	try {
		const parsed = JSON.parse(proc.stdout.toString());
		if (!parsed.AccessKeyId || !parsed.SecretAccessKey) return undefined;
		return {
			accessKeyId: parsed.AccessKeyId,
			secretAccessKey: parsed.SecretAccessKey,
			sessionToken: parsed.SessionToken || undefined,
		};
	} catch {
		return undefined;
	}
}

/**
 * Where `-p` uploads.
 *
 * Credentials are not among them. They come from the aws cli, exactly as the
 * container push does, and the env is consulted first only so that CI can set
 * `AWS_ACCESS_KEY_ID` without an aws config to point at.
 */
function registryTarget(): RegistryTarget {
	const bucket = env("REGISTRY_S3_BUCKET");
	const region = env("REGISTRY_S3_REGION");
	const endpoint = env("REGISTRY_S3_ENDPOINT");
	if (!bucket || !region || !endpoint) {
		throw new Error(
			"[registry] -p needs REGISTRY_S3_BUCKET, REGISTRY_S3_REGION and " +
				"REGISTRY_S3_ENDPOINT in the CLI env file",
		);
	}

	const fromEnv = {
		accessKeyId: env(
			"REGISTRY_S3_ACCESS_KEY_ID",
			"S3_ACCESS_KEY_ID",
			"AWS_ACCESS_KEY_ID",
		),
		secretAccessKey: env(
			"REGISTRY_S3_SECRET_ACCESS_KEY",
			"S3_SECRET_ACCESS_KEY",
			"AWS_SECRET_ACCESS_KEY",
		),
		sessionToken: env("AWS_SESSION_TOKEN"),
	};
	const credentials: Credentials | undefined =
		fromEnv.accessKeyId && fromEnv.secretAccessKey
			? {
					accessKeyId: fromEnv.accessKeyId,
					secretAccessKey: fromEnv.secretAccessKey,
					sessionToken: fromEnv.sessionToken,
				}
			: awsCliCredentials();
	if (!credentials) {
		throw new Error(
			"[registry] -p found no aws credentials. `aws configure export-credentials` " +
				"is what the container push authenticates with too, so if `release push` " +
				"works this should — check AWS_PROFILE, or set AWS_ACCESS_KEY_ID and " +
				"AWS_SECRET_ACCESS_KEY.",
		);
	}
	const source = fromEnv.accessKeyId ? "env" : "aws cli";

	return {
		client: new Bun.S3Client({
			bucket,
			endpoint,
			region,
			...credentials,
		}),
		description: `${endpoint}/${bucket} (credentials from ${source})`,
	};
}

function objectPrefix(): string {
	return env("REGISTRY_S3_PREFIX")?.replace(/^\/+|\/+$/g, "") ?? "";
}

function objectKey(name: string): string {
	const prefix = objectPrefix();
	return prefix ? `${prefix}/${name}` : name;
}

/**
 * The base URL a cluster is pointed at — what `spec.registry.url` becomes, and
 * what ptah appends a digest to.
 *
 * Derived rather than configured, because every part of it is already known:
 * getting it wrong by hand means a Platform that resolves names to digests
 * correctly and then fetches them from nowhere. `REGISTRY_URL` overrides the
 * whole thing for the case the bucket sits behind a CDN or a custom domain,
 * where nothing about the address can be inferred from the bucket at all.
 */
function registryUrl(): string | undefined {
	const explicit = env("REGISTRY_URL");
	if (explicit) return explicit.replace(/\/+$/, "");

	const bucket = env("REGISTRY_S3_BUCKET");
	const endpoint = env("REGISTRY_S3_ENDPOINT");
	if (!bucket || !endpoint) return undefined;

	const base = `${endpoint.replace(/\/+$/, "")}/${bucket}`;

	const prefix = objectPrefix();
	return prefix ? `${base}/${prefix}` : base;
}

/**
 * The mapping again, this time as Helm values for `core/tools/install/chart`.
 *
 * The chart already carries the whole of `spec.registry` — url, revision and
 * the name→digest map are read straight through by `templates/platform.yaml`.
 * What was missing is the only part a chart cannot know: which digests this
 * build produced. So the build writes them in the shape the chart consumes,
 * and installing a new set of modules is `helm upgrade -f registry.json`
 * rather than a hand-copied map.
 *
 * JSON rather than YAML because it is a generated file that nobody edits, and
 * because JSON is valid YAML — `helm -f` reads it either way. It is published
 * alongside `modules.json` so an installer with nothing but the registry URL
 * can fetch ready-made values instead of reassembling them from the manifest.
 */
type ChartValues = {
	registry: {
		url: string;
		revision: string;
		modules: Record<string, string>;
		workflows: Record<string, string>;
	};
};

function chartValues(mapping: Manifest, url: string): ChartValues {
	return {
		registry: {
			url,
			revision: mapping.revision,
			modules: mapping.modules,
			workflows: mapping.workflows,
		},
	};
}

/** The name both the local file and the published object go by. */
const VALUES_OBJECT = "registry.json";

/**
 * Every layer file the registry holds, this build's own included.
 *
 * Read back rather than remembered: the other layers are published by other
 * builds, possibly on other machines, and the whole point of composing here is
 * that neither build has to know when the other one ran.
 */
async function publishedLayers(
	client: Bun.S3Client,
	own: LayerFile,
): Promise<LayerFile[]> {
	const prefix = objectKey(`${LAYERS_PREFIX}/`);
	const listed = await client.list({ prefix });
	const layers: LayerFile[] = [own];
	for (const entry of listed.contents ?? []) {
		const name = basename(entry.key, ".json");
		if (!entry.key.endsWith(".json") || name === own.layer) continue;
		const body = await client.file(entry.key).text();
		layers.push(JSON.parse(body) as LayerFile);
	}
	return layers.sort((a, b) => a.layer.localeCompare(b.layer));
}

async function publish(
	options: Options,
	built: Built[],
	layer: LayerFile,
	url: string | undefined,
): Promise<Manifest> {
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

	// This layer's own names. Written last among the objects it refers to, so it
	// never points at bytes that are not there yet, and written at a key no
	// other layer touches.
	await client
		.file(objectKey(`${LAYERS_PREFIX}/${layer.layer}.json`))
		.write(JSON.stringify(layer, null, "\t"), {
			type: "application/json",
		});

	// Then the merged mapping, recomposed from every layer now in the registry
	// rather than from this build alone. Every publisher does this and they all
	// arrive at the same result, which is what makes publishing order stop
	// mattering.
	const layers = await publishedLayers(client, layer);
	const mapping = manifest(
		mergeLayers(layers),
		mergeLayers(layers, "workflows"),
	);
	console.log(
		`[registry] mapping covers ${layers.length} layer(s): ${layers
			.map((entry) => `${entry.layer}(${Object.keys(entry.modules).length})`)
			.join(", ")}`,
	);
	await client
		.file(objectKey("modules.json"))
		.write(JSON.stringify(mapping, null, "\t"), {
			type: "application/json",
		});
	const values = url ? chartValues(mapping, url) : undefined;
	// The chart values are the same mapping addressed to a different reader, so
	// they follow it rather than lead it, for the same reason.
	if (values) {
		await client
			.file(objectKey(VALUES_OBJECT))
			.write(JSON.stringify(values, null, "\t"), {
				type: "application/json",
			});
	}
	console.log(
		`[registry] published ${uploaded} new object(s), ${built.length - uploaded} already present`,
	);
	return mapping;
}

const options = parseArgs(Bun.argv.slice(2));
const built = await buildAll(options);
if (built.length === 0) throw new Error("[registry] nothing was built");

const layer = layerFile(options, built);
const url = registryUrl();

// Publishing composes the mapping from every layer in the registry and hands
// back the result; without `-p` there is nothing to read the other layers from,
// so the local files describe this layer alone and say so. That distinction is
// the whole fix: a partial mapping written as if it were the complete one is
// what let a product build erase the base layer's names.
const mapping = options.publish
	? await publish(options, built, layer, url)
	: manifest(layer.modules, layer.workflows);
if (!options.publish && layer.extends.length > 0) {
	console.warn(
		`[registry] local build: this mapping covers layer ${layer.layer} only, ` +
			`not ${layer.extends.join(", ")}. Publish with -p to compose the whole set.`,
	);
}

await Bun.write(
	join(options.outDir, `${LAYERS_PREFIX}/${layer.layer}.json`),
	`${JSON.stringify(layer, null, "\t")}\n`,
);
await Bun.write(
	join(options.outDir, "modules.json"),
	`${JSON.stringify(mapping, null, "\t")}\n`,
);

// Written whenever the address is knowable, `-p` or not: the values are how a
// cluster is moved onto this build, and wanting to inspect them before
// uploading anything is the normal case rather than an odd one.
const values = url ? chartValues(mapping, url) : undefined;
if (values) {
	await Bun.write(
		join(options.outDir, VALUES_OBJECT),
		`${JSON.stringify(values, null, "\t")}\n`,
	);
} else {
	console.warn(
		"[registry] no REGISTRY_URL or REGISTRY_S3_ENDPOINT/REGISTRY_S3_BUCKET, " +
			"so the chart values cannot be addressed and were not written",
	);
}
const shipped = built.reduce((sum, entry) => sum + entry.size, 0);
const raw = built.reduce((sum, entry) => sum + entry.raw, 0);
console.log(
	`[registry] ${built.length} module(s) → ${options.outDir}, revision ${mapping.revision.slice(0, 12)}…\n` +
		`[registry] ${(shipped / 1024 / 1024).toFixed(2)} MiB br, ${(raw / 1024 / 1024).toFixed(2)} MiB uncompressed`,
);

if (values) {
	console.log(
		`[registry] chart values → ${join(options.outDir, VALUES_OBJECT)}\n` +
			`[registry] apply with: helm upgrade --install … -f ${join(options.outDir, VALUES_OBJECT)}`,
	);
}
