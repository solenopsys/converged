import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { registerBaseModules } from "./base-modules";
import { moduleRegistryFromEnv } from "./module-registry";
import { createBunRedisCache } from "./server/bunRedisCache";
import type { PluginFactory } from "./server/createServer";
import { createServer, loadConfigFromEnv } from "./server/createServer";
import { createRuntimeImagesPlugin } from "./server/images.plugin";
import type { ServiceBinding } from "./server/service-registry";

process.on("uncaughtException", (err) => {
	console.error("[dev] uncaughtException:", err);
	process.exit(1);
});
process.on("unhandledRejection", (reason) => {
	console.error("[dev] unhandledRejection:", reason);
	process.exit(1);
});

/**
 * A Solution is the only description of what runs: a list of module names.
 * Paths, categories and image layout are not part of it — the names are
 * resolved against `modules/` by scanning, so moving a module between
 * categories does not touch any manifest.
 */
type Solution = {
	metadata?: { name?: string };
	spec: {
		repositories?: string[];
		lambdas?: string[];
		surfaces?: string[];
		workflows?: Array<{ name: string; script: string }>;
		env?: Record<string, string>;
	};
};

const PROJECT_DIR =
	process.env.PROJECT_DIR ?? resolve(import.meta.dir, "../../..");

const CHILD_PROJECT_DIR =
	process.env.CHILD_PROJECT_DIR && process.env.CHILD_PROJECT_DIR.length > 0
		? process.env.CHILD_PROJECT_DIR
		: undefined;

const ROOT = resolve(PROJECT_DIR, "../../..");

function parseDotEnv(content: string): Record<string, string> {
	const env: Record<string, string> = {};
	const lines = content.split(/\r?\n/);

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const normalized = line.startsWith("export ")
			? line.slice("export ".length).trim()
			: line;
		const eqIndex = normalized.indexOf("=");
		if (eqIndex <= 0) continue;

		const key = normalized.slice(0, eqIndex).trim();
		let value = normalized.slice(eqIndex + 1).trim();
		if (!key) continue;

		const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
		const isSingleQuoted = value.startsWith("'") && value.endsWith("'");
		if (isDoubleQuoted || isSingleQuoted) {
			value = value.slice(1, -1);
			if (isDoubleQuoted) {
				value = value
					.replace(/\\n/g, "\n")
					.replace(/\\r/g, "\r")
					.replace(/\\t/g, "\t");
			}
		} else {
			const inlineCommentIdx = value.indexOf(" #");
			if (inlineCommentIdx >= 0) {
				value = value.slice(0, inlineCommentIdx).trim();
			}
		}

		env[key] = value;
	}

	return env;
}

function loadDotEnvFiles(projectDir: string, parentDir?: string) {
	const legacyBootstrapDir = process.env.BOOTSTRAP_ENV_DIR;
	const privateBootstrapDir = process.env.PRIVATE_BOOTSTRAP_ENV_DIR;
	const dirCandidates = [
		projectDir,
		parentDir,
		legacyBootstrapDir,
		privateBootstrapDir,
		resolve(ROOT, "saas/public/saas-bootstrap"),
	].filter((value): value is string => Boolean(value));
	const dirs = Array.from(new Set(dirCandidates));
	const names = [
		".env",
		".env.local",
		".env.development",
		".env.development.local",
	];

	const loadedFiles: string[] = [];
	let loadedKeys = 0;

	for (const dir of dirs) {
		for (const name of names) {
			const envPath = resolve(dir, name);
			if (!existsSync(envPath)) continue;

			const parsed = parseDotEnv(readFileSync(envPath, "utf8"));
			loadedFiles.push(envPath);

			for (const [key, value] of Object.entries(parsed)) {
				if (process.env[key] !== undefined) continue;
				process.env[key] = value;
				loadedKeys += 1;
			}
		}
	}

	if (loadedFiles.length > 0) {
		console.log(
			`[back-core] Loaded ${loadedKeys} env keys from ${loadedFiles.length} .env file(s)`,
		);
	}
}

async function loadSolution(): Promise<Solution> {
	const path =
		process.env.SOLUTION_PATH ||
		resolve(PROJECT_DIR, "solutions", "converged.json");
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`Solution not found: ${path}`);
	}
	console.log(`[back-core] Solution: ${path}`);
	return file.json();
}

/**
 * In a built image there are no modules on disk. The image is the server and
 * nothing else; a backend module is fetched from ptah by digest at boot, which is
 * what lets one image serve any solution without carrying every module in the
 * tree — and what lets a module roll forward without rebuilding the image.
 *
 * Without a registry — every dev run — resolution falls back to scanning source,
 * which is what makes an edit visible on restart.
 */
const registry = moduleRegistryFromEnv();
if (registry) {
	console.log(`[back-core] Module registry: ${registry.revision}`);
	// Before the first module is imported: a registry bundle asks for `back-core`
	// and `nrpc` by name, and this is what those names resolve to.
	registerBaseModules();
}

/**
 * `rp-orders` lives under some category directory, but which one is an
 * organisational detail that the Solution deliberately does not carry. One
 * glob keeps the name the only identity a module has.
 */
type BackendKind = "repositories" | "lambdas";

const backendPrefix = (kind: BackendKind): "rp-" | "lm-" =>
	kind === "repositories" ? "rp-" : "lm-";

function resolveServiceDir(name: string, kind: BackendKind): string | null {
	const projectDirs = [CHILD_PROJECT_DIR, PROJECT_DIR].filter(
		(value): value is string => Boolean(value),
	);
	const prefix = backendPrefix(kind);
	for (const projectDir of projectDirs) {
		const modulesDir = resolve(projectDir, "modules", kind);
		const direct = resolve(modulesDir, `${prefix}${name}`);
		if (existsSync(direct)) return direct;
		const [match] = new Bun.Glob(`*/${prefix}${name}`).scanSync({
			cwd: modulesDir,
			onlyFiles: false,
			absolute: true,
		});
		if (match) return match;
	}
	return null;
}

function resolveImplementationPath(svcDir: string): string | null {
	for (const relativePath of [
		"src/index.ts",
		"index.ts",
		"src/service.ts",
		"service.ts",
	]) {
		const candidate = resolve(svcDir, relativePath);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

function resolveMetadataPath(name: string): string | null {
	for (const projectDir of [CHILD_PROJECT_DIR, PROJECT_DIR]) {
		if (!projectDir) continue;
		const candidate = resolve(
			projectDir,
			"modules/generated",
			`g-${name}`,
			"src/index.ts",
		);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

/**
 * A registry artifact is one file carrying both halves of a backend module — the
 * implementation and its generated nrpc metadata — because a digest names one
 * file. From source they are still two, so both shapes are read here rather
 * than made uniform: source resolution is what a dev run depends on.
 */
async function importService(
	name: string,
	kind: BackendKind,
): Promise<{ implementation: unknown; metadata: unknown }> {
	const artifact = `${backendPrefix(kind)}${name}.js`;
	if (registry) {
		const module = await import(
			pathToFileURL(await registry.load(artifact)).href
		);
		return { implementation: module.implementation, metadata: module.metadata };
	}

	const svcDir = resolveServiceDir(name, kind);
	const implementationPath = svcDir && resolveImplementationPath(svcDir);
	if (!implementationPath) throw new Error(`No source for ${artifact}`);
	const metadataPath = resolveMetadataPath(name);
	if (!metadataPath) throw new Error(`No generated g-${name}`);

	const [implementationModule, metadataModule] = await Promise.all([
		import(pathToFileURL(implementationPath).href),
		import(pathToFileURL(metadataPath).href),
	]);
	return {
		implementation: implementationModule.default,
		metadata: metadataModule.metadata,
	};
}

async function loadBackendModules(
	groups: Array<{ kind: BackendKind; names: string[] }>,
) {
	const services: ServiceBinding[] = [];
	const failed: string[] = [];

	for (const { kind, names } of groups) {
		for (const name of names) {
			try {
				const { implementation, metadata } = await importService(name, kind);
				if (!implementation) {
					throw new Error(`Missing default ServiceImpl export for ${name}`);
				}
				if (!metadata) {
					throw new Error(`Missing generated metadata for ${name}`);
				}
				services.push({
					name,
					implementation,
					metadata,
				} as ServiceBinding);
			} catch (error) {
				failed.push(
					`${backendPrefix(kind)}${name}: ${error instanceof Error ? error.message : error}`,
				);
			}
		}
	}

	if (failed.length > 0) {
		console.warn(
			`[back-core] Missing backend modules:\n  - ${failed.join("\n  - ")}`,
		);
	}

	return services;
}

loadDotEnvFiles(PROJECT_DIR, CHILD_PROJECT_DIR);

if (!process.env.SERVICE_TOKEN?.trim()) {
	throw new Error(
		"SERVICE_TOKEN must be an Ed25519 service JWT issued by rp-access",
	);
}

const port = Number(process.env.PORT || process.env.SERVICES_PORT || 3000);
const dataDir = process.env.DATA_DIR || resolve(PROJECT_DIR, "data");
if (!process.env.SERVICES_BASE) {
	process.env.SERVICES_BASE = `http://127.0.0.1:${port}/services`;
}

const solution = await loadSolution();
const repositories = solution.spec.repositories ?? [];
const lambdas = solution.spec.lambdas ?? [];

const services = await loadBackendModules([
	{ kind: "repositories", names: repositories },
	{ kind: "lambdas", names: lambdas },
]);
const plugins: PluginFactory[] = [];

const servicePaths: Record<string, string> = {};
for (const name of repositories) {
	servicePaths[name] = resolve(dataDir, name);
}

const runtimeCache = createBunRedisCache({
	url: process.env.VALKEY_URL,
	keyPrefix: process.env.VALKEY_KEY_PREFIX || "cache",
	defaultTtlSeconds: Number(process.env.VALKEY_TTL_SECONDS || 120),
});

const server = createServer({
	config: {
		...loadConfigFromEnv(),
		name: solution.metadata?.name || "converged",
		port,
		dataDir,
		extraConfig: {
			servicePaths,
			apiKey: process.env.GOOGLE_API_KEY || "",
			cx: process.env.GOOGLE_CX || "",
			cache: runtimeCache,
			valkey: runtimeCache,
		},
	},
	services,
	plugins,
});

server.app.use(
	createRuntimeImagesPlugin({
		cache: runtimeCache,
		cacheControl: process.env.IMAGE_CACHE_CONTROL,
		fallbackScope: process.env.STORAGE_SCOPE,
	}),
);

// Frontend hosts own their HTTP lifecycle. They can no longer be embedded here:
// their plugin contract is not part of the back-core server contract.

await server.start();
