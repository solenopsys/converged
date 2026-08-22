#!/usr/bin/env bun
/**
 * Builder-stage bundler for the `ms` and `ui` images.
 *
 * This replaces the code the configurator used to generate. The difference is
 * what decides the contents: the configurator was handed one solution's module
 * list and baked it in, so every solution needed its own image. Here the module
 * set is discovered from the tree — the image carries the **superset** and the
 * runtime picks a subset from `MICROSERVICES` / `FRONTEND_MODULES`. That is why
 * the Containerfile can stay a static file and still serve any solution.
 *
 * What ships is a bundle, not a source tree: the runtime stage copies `out/`
 * onto Cruller and nothing else. No workspace `node_modules`, no zig sources,
 * no frontend in the `ms` image.
 *
 * Output layout under `--out`:
 *
 *   app/server.js              bundled production entrypoint
 *   app/runtime-map.toml       module name → chunk path, over the superset
 *   app/package.json           external prod deps only (installed separately)
 *   plugins/chunks/…           one entry chunk per module, shared code split out
 *   plugins/bin-libs/…         the dlopen'd .so files for this arch
 *
 * Chunk paths are deterministic: `Bun.build({ root })` mirrors each entrypoint's
 * path relative to `root` under `outdir`, so the map is computed from the source
 * paths rather than parsed back out of the build result.
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

type Role = "ms" | "ui";

type Module = {
	/** Bare module name: `counters`, not `ms-counters`. */
	name: string;
	/** Absolute path to the module's entry source file. */
	implementation: string;
	/** Absolute path to the generated nrpc metadata entry, `ms` only. */
	metadata?: string;
};

type Options = {
	role: Role;
	/** Directory holding `converged/` and, when layered, the product. */
	root: string;
	/** Converged checkout — the base layer. */
	projectDir: string;
	/** Product checkout when one extends converged, else undefined. */
	childProjectDir?: string;
	outDir: string;
	/** Absolute path the runtime will see `plugins/chunks` at. */
	chunksMountPath: string;
	/** Absolute path the runtime will see the client delivery at, `ui` only. */
	deliveryMountPath: string;
	/** Absolute path the runtime will see the landing's assets at, `ui` only. */
	publicMountPath: string;
};

/** Entry file names a module may use, in the order the dev loader tries them. */
const ENTRY_CANDIDATES = [
	"src/index.ts",
	"index.ts",
	"src/service.ts",
	"service.ts",
];

function parseArgs(argv: string[]): Options {
	const values = new Map<string, string>();
	for (const arg of argv) {
		const match = /^--([^=]+)=(.*)$/.exec(arg);
		if (match) values.set(match[1], match[2]);
	}

	const role = values.get("role");
	if (role !== "ms" && role !== "ui") {
		throw new Error("--role=<ms|ui> is required");
	}
	const root = values.get("root");
	if (!root) throw new Error("--root=<dir holding converged/> is required");
	const projectDir = values.get("project-dir");
	if (!projectDir) throw new Error("--project-dir=<converged checkout> is required");
	const outDir = values.get("out");
	if (!outDir) throw new Error("--out=<dir> is required");

	const childProjectDir = values.get("child-project-dir")?.trim();
	return {
		role,
		root: resolve(root),
		projectDir: resolve(projectDir),
		childProjectDir:
			childProjectDir && childProjectDir !== projectDir
				? resolve(childProjectDir)
				: undefined,
		outDir: resolve(outDir),
		chunksMountPath: values.get("chunks-mount") ?? "/app/plugins/chunks",
		deliveryMountPath: values.get("delivery-mount") ?? "/app/dist/front",
		publicMountPath: values.get("public-mount") ?? "/app/public",
	};
}

/**
 * Module directories live either directly under `modules/<kind>` or one
 * category level down. Which of the two is an organisational detail — the same
 * ambiguity `resolveServiceDir` in the dev loader handles — so both are scanned.
 */
function moduleDirs(modulesRoot: string, prefix: string): string[] {
	if (!existsSync(modulesRoot)) return [];
	const found: string[] = [];
	for (const entry of readdirSync(modulesRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const path = join(modulesRoot, entry.name);
		if (entry.name.startsWith(prefix)) {
			found.push(path);
			continue;
		}
		for (const nested of readdirSync(path, { withFileTypes: true })) {
			if (nested.isDirectory() && nested.name.startsWith(prefix)) {
				found.push(join(path, nested.name));
			}
		}
	}
	return found;
}

function resolveEntry(moduleDir: string): string | null {
	for (const candidate of ENTRY_CANDIDATES) {
		const path = join(moduleDir, candidate);
		if (existsSync(path)) return path;
	}
	return null;
}

function resolveMetadata(projectDirs: string[], name: string): string | null {
	for (const projectDir of projectDirs) {
		const path = join(projectDir, "modules/generated", `g-${name}`, "src/index.ts");
		if (existsSync(path)) return path;
	}
	return null;
}

/**
 * The superset, product first. A product module of the same name shadows the
 * converged one, which is the same precedence the dev loader applies.
 */
function discover(options: Options, kind: "microservices" | "microfrontends"): Module[] {
	const prefix = kind === "microservices" ? "ms-" : "mf-";
	const projectDirs = [options.childProjectDir, options.projectDir].filter(
		(value): value is string => Boolean(value),
	);

	const modules = new Map<string, Module>();
	for (const projectDir of projectDirs) {
		for (const dir of moduleDirs(join(projectDir, "modules", kind), prefix)) {
			const name = basename(dir).slice(prefix.length);
			if (modules.has(name)) continue;

			const implementation = resolveEntry(dir);
			if (!implementation) {
				console.warn(`[bundle] ${prefix}${name}: no entry file, skipped`);
				continue;
			}
			if (kind === "microfrontends") {
				modules.set(name, { name, implementation });
				continue;
			}
			// A microservice without generated metadata cannot be registered, and
			// discovering that at boot in production is far worse than here.
			const metadata = resolveMetadata(projectDirs, name);
			if (!metadata) {
				console.warn(`[bundle] ms-${name}: no generated g-${name}, skipped`);
				continue;
			}
			modules.set(name, { name, implementation, metadata });
		}
	}
	return [...modules.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Where `Bun.build({ root, outdir })` puts the entry chunk for one source file. */
function chunkPath(options: Options, source: string): string {
	const fromRoot = relative(options.root, source).replace(/\.tsx?$/, ".js");
	return join(options.chunksMountPath, fromRoot);
}

function tomlString(value: string): string {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/**
 * The landing host belongs to the product, not to converged: it statically
 * imports its own blocks, SPA plugin and locale set. The dev runner picks it
 * the same way (`core/tools/dev/src/cli.ts`), and a built image that used the
 * base host instead would serve converged blocks against a delivery compiled
 * from the product's — the exact mismatch `spa/src/build/layout.ts` guards.
 */
function resolveLandingDir(options: Options): string {
	const candidates = [options.childProjectDir, options.projectDir]
		.filter((value): value is string => Boolean(value))
		.map((projectDir) => join(projectDir, "core/frontend/landing"));
	for (const dir of candidates) {
		if (existsSync(join(dir, "src/plugin.tsx")) || existsSync(join(dir, "src/plugin.ts"))) {
			return dir;
		}
	}
	throw new Error(`[bundle] no landing host found in: ${candidates.join(", ")}`);
}

/**
 * A generated entry rather than the project's own `src/dev.ts`, because the
 * two disagree on exactly one thing: a source run finds `public/` and `dist/`
 * next to itself, and a single bundled file cannot. Everything else — which
 * plugins, which host — is taken from the project unchanged.
 */
async function writeUiEntry(options: Options, landingDir: string): Promise<string> {
	const projectRoot = options.childProjectDir ?? options.projectDir;
	const spaPlugin = join(projectRoot, "core/frontend/spa/src/plugin.ts");
	const spaImport = existsSync(spaPlugin)
		? spaPlugin
		: join(options.projectDir, "core/frontend/spa/src/plugin.ts");
	const landingPlugin = existsSync(join(landingDir, "src/plugin.tsx"))
		? join(landingDir, "src/plugin.tsx")
		: join(landingDir, "src/plugin.ts");
	const devServer = join(options.projectDir, "core/frontend/landing/src/dev-server.ts");

	// `production` is a literal, not `process.env.NODE_ENV`: the bundler folds
	// that read at build time, and this step does not run with NODE_ENV set — the
	// image would then boot into the dev branch and try to rebuild the delivery
	// from sources it does not carry.
	const source = `// Generated by core/containers/bundle.ts — do not edit.
import spaPlugin from ${JSON.stringify(spaImport)};
import landingPlugin from ${JSON.stringify(landingPlugin)};
import { startLandingDevServer, requiredLandingEnv } from ${JSON.stringify(devServer)};

const production = true;

await startLandingDevServer({
	name: ${JSON.stringify(`${basename(projectRoot)}-landing`)},
	projectDir: requiredLandingEnv("PROJECT_DIR"),
	publicDir: ${JSON.stringify(options.publicMountPath)},
	spa: spaPlugin({ production, distDir: ${JSON.stringify(options.deliveryMountPath)} }),
	landing: landingPlugin({ production, publicDir: ${JSON.stringify(options.publicMountPath)} }),
});
`;
	const path = join(options.outDir, "entry.ts");
	await Bun.write(path, source);
	return path;
}

async function buildMs(options: Options): Promise<void> {
	const modules = discover(options, "microservices");
	if (modules.length === 0) {
		throw new Error(`[bundle] no microservices found under ${options.root}`);
	}
	console.log(`[bundle] ${modules.length} microservices: ${modules.map((m) => m.name).join(", ")}`);

	const chunksDir = join(options.outDir, "plugins/chunks");
	mkdirSync(chunksDir, { recursive: true });

	// The same entry the dev runner starts. It is one maintained code path: what
	// differs in the image is RUNTIME_MAP_PATH, which switches module resolution
	// from scanning source to reading the map written below.
	const serverEntry = join(options.projectDir, "core/backend/src/dev.ts");
	if (!existsSync(serverEntry)) {
		throw new Error(`[bundle] server entrypoint not found: ${serverEntry}`);
	}

	const entrypoints = [
		...modules.map((module) => module.implementation),
		...modules.map((module) => module.metadata).filter((path): path is string => Boolean(path)),
	];

	// One build for every module: splitting hoists the shared code — back-core,
	// nrpc, preact — into common chunks instead of copying it per module.
	await run({
		entrypoints,
		outdir: chunksDir,
		root: options.root,
		splitting: true,
	}, "modules");
	await run({ entrypoints: [serverEntry], outdir: join(options.outDir, "app"), naming: "server.js" }, "server");

	const lines = [
		"# Generated by core/containers/bundle.ts — the module superset in this image.",
		"# Which of these actually boot is a runtime decision: the entrypoint keeps",
		"# only the names the Solution lists.",
		"",
		"[services]",
		"",
	];
	for (const module of modules) {
		lines.push(`[services.${tomlString(module.name)}]`);
		lines.push(`implementation = ${tomlString(chunkPath(options, module.implementation))}`);
		if (module.metadata) {
			lines.push(`metadata = ${tomlString(chunkPath(options, module.metadata))}`);
		}
		lines.push("");
	}
	await Bun.write(join(options.outDir, "app/runtime-map.toml"), lines.join("\n"));
	console.log(`[bundle] runtime-map.toml: ${modules.length} entries`);
}

/**
 * The ui server is one bundle: the landing host with its SSR blocks and the
 * SPA plugin. The microfrontends are not bundled here — they are already in
 * the client delivery the SPA build produced, and the browser narrows them
 * through the import map from `FRONTEND_MODULES`.
 */
async function buildUi(options: Options): Promise<void> {
	const landingDir = resolveLandingDir(options);
	console.log(`[bundle] landing host: ${landingDir}`);
	mkdirSync(options.outDir, { recursive: true });
	const entry = await writeUiEntry(options, landingDir);
	await run({ entrypoints: [entry], outdir: join(options.outDir, "app"), naming: "server.js" }, "server");
}

/** One place for the build flags every bundle in this image shares. */
async function run(
	config: Parameters<typeof Bun.build>[0],
	label: string,
): Promise<void> {
	const result = await Bun.build({
		target: "bun",
		format: "esm",
		minify: true,
		// Both load prebuilt native binaries of their own. Bundled, the copy
		// that ships cannot find them, and only at the first call.
		external: ["sharp", "lightningcss"],
		...config,
	});
	if (!result.success) {
		for (const log of result.logs) console.error(log);
		throw new Error(`[bundle] ${label} build failed`);
	}
	console.log(`[bundle] ${label}: ${result.outputs.length} chunks`);
}

async function build(options: Options): Promise<void> {
	mkdirSync(join(options.outDir, "app"), { recursive: true });
	if (options.role === "ms") await buildMs(options);
	else await buildUi(options);
}

await build(parseArgs(Bun.argv.slice(2)));
