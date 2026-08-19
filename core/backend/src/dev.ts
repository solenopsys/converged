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

type BuildConfig = {
	name?: string;
	extends?: string;
	back: {
		core?: string;
		runtimes?: Record<string, string[]>;
		microservices: Record<string, string[]>;
	};
	spa?: {
		core?: string;
		microfrontends?: string[];
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

async function loadConfig(configPath: string): Promise<BuildConfig> {
	const file = Bun.file(configPath);
	if (!(await file.exists())) {
		throw new Error(`Config not found: ${configPath}`);
	}
	return file.json();
}

async function loadMergedConfig(projectDir: string, parentDir?: string) {
	const configPath =
		process.env.CONFIG_PATH || resolve(projectDir, "config.json");
	const config = await loadConfig(configPath);
	if (!config.extends || !parentDir) {
		return { config, parentDir: undefined };
	}

	const parentConfig = await loadConfig(resolve(parentDir, "config.json"));
	const merged: BuildConfig = {
		...config,
		back: {
			core: config.back.core || parentConfig.back.core,
			runtimes: {
				...(parentConfig.back.runtimes ?? {}),
				...(config.back.runtimes ?? {}),
			},
			microservices: {
				...parentConfig.back.microservices,
				...config.back.microservices,
			},
		},
		spa: {
			core: config.spa?.core || parentConfig.spa?.core,
			microfrontends: [
				...(parentConfig.spa?.microfrontends ?? []),
				...(config.spa?.microfrontends ?? []),
			],
		},
	};

	return { config: merged, parentDir };
}

function resolveServiceDir(
	projectDir: string,
	parentDir: string | undefined,
	category: string,
	name: string,
) {
	const categorized = resolve(
		projectDir,
		"back/microservices",
		category,
		`ms-${name}`,
	);
	if (existsSync(categorized)) return categorized;
	const flat = resolve(projectDir, "back/microservices", `ms-${name}`);
	if (existsSync(flat)) return flat;
	if (parentDir) {
		const parentCategorized = resolve(
			parentDir,
			"back/microservices",
			category,
			`ms-${name}`,
		);
		if (existsSync(parentCategorized)) return parentCategorized;
		const parentFlat = resolve(parentDir, "back/microservices", `ms-${name}`);
		if (existsSync(parentFlat)) return parentFlat;
	}
	return null;
}

function resolveRuntimeDir(
	projectDir: string,
	parentDir: string | undefined,
	category: string,
	name: string,
) {
	const categorized = resolve(
		projectDir,
		"back/runtimes",
		category,
		`rt-${name}`,
	);
	if (existsSync(categorized)) return categorized;
	if (parentDir) {
		const parentCategorized = resolve(
			parentDir,
			"back/runtimes",
			category,
			`rt-${name}`,
		);
		if (existsSync(parentCategorized)) return parentCategorized;
	}
	return null;
}

function resolveImplementationPath(svcDir: string): string | null {
	for (const relativePath of ["src/index.ts", "index.ts", "src/service.ts", "service.ts"]) {
		const candidate = resolve(svcDir, relativePath);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

function resolveMetadataPath(projectDir: string, parentDir: string | undefined, name: string): string | null {
	for (const root of [projectDir, parentDir]) {
		if (!root) continue;
		const candidate = resolve(root, "tools/generated", `g-${name}`, "src/index.ts");
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

function resolveRuntimePluginPath(runtimeDir: string): string {
	const source = resolve(runtimeDir, "src/plugin.ts");
	return existsSync(source) ? source : resolve(runtimeDir, "plugin.ts");
}

async function loadMicroservices(
	projectDir: string,
	parentDir: string | undefined,
	config: BuildConfig,
) {
	const services: ServiceBinding[] = [];
	const missing: string[] = [];

	for (const [category, serviceNames] of Object.entries(
		config.back.microservices,
	)) {
		for (const name of serviceNames) {
			const svcDir = resolveServiceDir(projectDir, parentDir, category, name);
			if (!svcDir) {
				missing.push(`${category}/${name}`);
				continue;
			}
			const implementationPath = resolveImplementationPath(svcDir);
			if (!implementationPath) {
				missing.push(`${category}/${name}`);
				continue;
			}
			const metadataPath = resolveMetadataPath(projectDir, parentDir, name);
			if (!metadataPath) {
				missing.push(`${category}/${name} (generated metadata)`);
				continue;
			}
			try {
				const [implementationModule, metadataModule] = await Promise.all([
					import(pathToFileURL(implementationPath).href),
					import(pathToFileURL(metadataPath).href),
				]);
				const implementation = implementationModule.default;
				if (!implementation) {
					throw new Error(`Missing default ServiceImpl export for ${category}/${name}`);
				}
				if (!metadataModule.metadata) {
					throw new Error(`Missing generated metadata for ${category}/${name}`);
				}
				services.push({ name, implementation, metadata: metadataModule.metadata });
				continue;
			} catch (err) {
				console.error(
					`[back-core] Failed to load microservice ${category}/${name} at ${implementationPath}`,
				);
				throw err;
			}
		}
	}

	if (missing.length > 0) {
		console.warn(`[back-core] Missing microservices: ${missing.join(", ")}`);
	}

	return services;
}

async function loadRuntimePlugins(
	projectDir: string,
	parentDir: string | undefined,
	config: BuildConfig,
) {
	const plugins: PluginFactory[] = [];
	const missing: string[] = [];

	for (const [category, runtimes] of Object.entries(
		config.back.runtimes ?? {},
	)) {
		for (const name of runtimes) {
			const rtDir = resolveRuntimeDir(projectDir, parentDir, category, name);
			if (!rtDir) {
				missing.push(`${category}/${name}`);
				continue;
			}
			const pluginPath = resolveRuntimePluginPath(rtDir);
			try {
				const mod = await import(pathToFileURL(pluginPath).href);
				const pluginFactory = mod.default ?? mod.plugin ?? mod;
				if (typeof pluginFactory !== "function") {
					throw new Error(
						`Invalid runtime plugin factory for ${category}/${name}`,
					);
				}
				const rootPlugin = ((pluginConfig: any) =>
					pluginFactory(pluginConfig)) as PluginFactory;
				rootPlugin.mount = "root";
				plugins.push(rootPlugin);
			} catch (err) {
				console.error(
					`[back-core] Failed to import runtime plugin ${category}/${name} at ${pluginPath}`,
				);
				throw err;
			}
		}
	}

	if (missing.length > 0) {
		console.warn(`[back-core] Missing runtimes: ${missing.join(", ")}`);
	}

	return plugins;
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

const { config, parentDir } = await loadMergedConfig(
	PROJECT_DIR,
	CHILD_PROJECT_DIR,
);

const services = await loadMicroservices(PROJECT_DIR, parentDir, config);
const plugins: PluginFactory[] = [];
plugins.push(...(await loadRuntimePlugins(PROJECT_DIR, parentDir, config)));

const servicePaths: Record<string, string> = {};
for (const services of Object.values(config.back.microservices)) {
	for (const name of services) {
		servicePaths[name] = resolve(dataDir, name);
	}
}

const runtimeCache = createBunRedisCache({
	url: process.env.VALKEY_URL,
	keyPrefix: process.env.VALKEY_KEY_PREFIX || "cache",
	defaultTtlSeconds: Number(process.env.VALKEY_TTL_SECONDS || 120),
});

const server = createServer({
	config: {
		...loadConfigFromEnv(),
		name: config.name || "converged",
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
if (config.landing) {
	console.info(
		"[back-core] Frontend plugins are not mounted; run SPA and landing hosts separately.",
	);
}

await server.start();
