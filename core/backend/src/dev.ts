import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";
import { createServer, loadConfigFromEnv } from "./server/createServer";
import { createBunRedisCache } from "./server/bunRedisCache";
import { createRuntimeImagesPlugin } from "./server/images.plugin";
import type { PluginFactory } from "./server/createServer";
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
		microservices?: string[];
		microfrontends?: string[];
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
 * `ms-orders` lives under some category directory, but which one is an
 * organisational detail that the Solution deliberately does not carry. One
 * glob keeps the name the only identity a module has.
 */
function resolveServiceDir(name: string): string | null {
	const [match] = new Bun.Glob(`*/ms-${name}`).scanSync({
		cwd: resolve(PROJECT_DIR, "modules/microservices"),
		onlyFiles: false,
		absolute: true,
	});
	return match ?? null;
}

function resolveImplementationPath(svcDir: string): string | null {
	for (const relativePath of ["src/index.ts", "index.ts", "src/service.ts", "service.ts"]) {
		const candidate = resolve(svcDir, relativePath);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

function resolveMetadataPath(name: string): string | null {
	const candidate = resolve(
		PROJECT_DIR,
		"modules/generated",
		`g-${name}`,
		"src/index.ts",
	);
	return existsSync(candidate) ? candidate : null;
}

async function loadMicroservices(names: string[]) {
	const services: ServiceBinding[] = [];
	const missing: string[] = [];

	for (const name of names) {
		const svcDir = resolveServiceDir(name);
		if (!svcDir) {
			missing.push(name);
			continue;
		}
		const implementationPath = resolveImplementationPath(svcDir);
		if (!implementationPath) {
			missing.push(name);
			continue;
		}
		const metadataPath = resolveMetadataPath(name);
		if (!metadataPath) {
			missing.push(`${name} (generated metadata)`);
			continue;
		}
		try {
			const [implementationModule, metadataModule] = await Promise.all([
				import(pathToFileURL(implementationPath).href),
				import(pathToFileURL(metadataPath).href),
			]);
			const implementation = implementationModule.default;
			if (!implementation) {
				throw new Error(`Missing default ServiceImpl export for ${name}`);
			}
			if (!metadataModule.metadata) {
				throw new Error(`Missing generated metadata for ${name}`);
			}
			services.push({ name, implementation, metadata: metadataModule.metadata });
		} catch (err) {
			console.error(
				`[back-core] Failed to load microservice ${name} at ${implementationPath}`,
			);
			throw err;
		}
	}

	if (missing.length > 0) {
		console.warn(`[back-core] Missing microservices: ${missing.join(", ")}`);
	}

	return services;
}

loadDotEnvFiles(PROJECT_DIR, CHILD_PROJECT_DIR);

if (!process.env.SERVICE_TOKEN?.trim()) {
	throw new Error(
		"SERVICE_TOKEN must be an Ed25519 service JWT issued by ms-access",
	);
}

const port = Number(process.env.PORT || process.env.SERVICES_PORT || 3000);
const dataDir = process.env.DATA_DIR || resolve(PROJECT_DIR, "data");
if (!process.env.SERVICES_BASE) {
	process.env.SERVICES_BASE = `http://127.0.0.1:${port}/services`;
}

const solution = await loadSolution();
const microservices = solution.spec.microservices ?? [];

const services = await loadMicroservices(microservices);
const plugins: PluginFactory[] = [];

const servicePaths: Record<string, string> = {};
for (const name of microservices) {
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
