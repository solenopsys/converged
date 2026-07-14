import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	CACHE_BLOB_TTL_SECONDS,
	type CacheAdapter,
} from "../../back/back-core/src/server/createServer";
import { installBackendLogBridge } from "../../back/back-core/src/server/logBridge";
import { loadAiProvidersFromEnv } from "../../back/back-core/src/server/envConfig";
import {
	enterRequestScopeContext,
	getCurrentStorageScope,
	resolveRequestScopeFromHeaders,
	runWithRequestScopeContext,
} from "../../back/back-core/src/request-context";
import {
	assertSettings,
	CLOUD_STORAGE_CHECKLIST,
	printSettings,
} from "../../back/back-core/src/config/settings";
import { createValkeyCache } from "./valkey";
import { createRuntimeImagesPlugin } from "./images.plugin";
import { createAuthServiceClient } from "g-auth";

type RuntimeMap = {
	services: Record<string, string>;
	spa?: {
		plugin?: string;
	};
	landing?: {
		plugin?: string;
	};
	cache?: {
		url?: string;
		keyPrefix?: string;
		ssrTtlSeconds?: number;
	};
};

type RuntimeConfig = {
	spa?: {
		microfrontends?: string[];
	};
	frontend?: {
		modules?: Record<string, boolean>;
	};
};

const appRoot = process.env.APP_ROOT || process.cwd();
const projectDir = process.env.PROJECT_DIR || appRoot;
const port = Number(process.env.PORT || "3000");
const dataRoot = process.env.DATA_DIR || resolve(appRoot, "data");
const runtimeMapPath =
	process.env.RUNTIME_MAP_PATH || resolve(appRoot, "runtime-map.toml");
const pluginsRoot = resolve(appRoot, "plugins");
const binLibsPath =
	process.env.BIN_LIBS_PATH || resolve(pluginsRoot, "bin-libs");

function readRuntimeMap(path: string): RuntimeMap {
	const content = readFileSync(path, "utf8");
	return Bun.TOML.parse(content) as RuntimeMap;
}

function readRuntimeConfig(path: string): RuntimeConfig {
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, "utf8")) as RuntimeConfig;
	} catch (error) {
		console.warn("[runtime] failed to read config:", path, error);
		return {};
	}
}

function normalizeMfName(name: string): string {
	return name.startsWith("mf-") ? name : `mf-${name}`;
}

function resolveRuntimeMicrofrontends(config: RuntimeConfig): string[] {
	const fromSpa = Array.isArray(config.spa?.microfrontends)
		? config.spa.microfrontends
		: [];
	const fromModules = Object.entries(config.frontend?.modules ?? {})
		.filter(([, enabled]) => enabled)
		.map(([name]) => name);
	return [...new Set([...fromSpa, ...fromModules].map(normalizeMfName))];
}

function resolveEnabledRuntimes(): Set<string> | null {
	const raw = process.env.RT_RUNTIMES || process.env.RUNTIMES || "";
	const values = raw
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	return values.length > 0 ? new Set(values) : null;
}

function requireEnvUrl(name: string, example: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required. Set it to ${example}.`);
	}
	return value.replace(/\/+$/, "");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

async function importPlugin(path: string) {
	const mod = await import(pathToFileURL(path).href);
	const plugin = mod.default ?? mod.plugin ?? mod;
	if (typeof plugin !== "function") {
		throw new Error(`Invalid plugin export at ${path}`);
	}
	return plugin as (cfg: any) => any;
}

// Startup checklist: validate every required setting before doing anything.
// If a single one is missing/invalid the container crashes here with the full
// list — production infrastructure must be fully configured, no fallbacks.
assertSettings(CLOUD_STORAGE_CHECKLIST);

process.env.BIN_LIBS_PATH = binLibsPath;
process.env.PROJECT_DIR = projectDir;
const servicesBaseUrl = requireEnvUrl(
	"SERVICES_BASE",
	"the services endpoint, for example http://host:port/services",
);
process.env.SERVICES_BASE = servicesBaseUrl;

async function generateServiceToken(secret: string): Promise<string> {
	const encode = (obj: object) =>
		Buffer.from(JSON.stringify(obj)).toString("base64url");
	const header = encode({ alg: "HS256", typ: "JWT" });
	const payload = encode({
		sub: "service-account",
		perm: ["*/*( rw)"],
		iat: Math.floor(Date.now() / 1000),
	});
	const data = `${header}.${payload}`;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(data),
	);
	return `${data}.${Buffer.from(sig).toString("base64url")}`;
}

if (!process.env.ACCESS_JWT_SECRET) {
	throw new Error("ACCESS_JWT_SECRET is not set");
}
process.env.SERVICE_TOKEN = await generateServiceToken(
	process.env.ACCESS_JWT_SECRET,
);
(globalThis as any).__NRPC_CLIENT_ENV__ = {
	...(globalThis as any).__NRPC_CLIENT_ENV__,
	baseUrl: servicesBaseUrl,
	serviceToken: process.env.SERVICE_TOKEN,
	headers: (globalThis as any).__NRPC_CLIENT_ENV__?.headers,
};

// Propagate the storage scope onto every nrpc call to the services. Without this
// the scope set on the incoming request (UI/MS, per-request header mechanism) or
// explicitly pinned for a per-tenant runtime by the operator (STORAGE_SCOPE)
// never reaches service-to-service calls, so the callee has no scope.
//   - In an HTTP request: getCurrentStorageScope() returns the request's scope.
//   - In a runtime cron/workflow (no request): it uses configured STORAGE_SCOPE,
//     the single tenant scope this RT instance is bound to.
const pinnedStorageScope = process.env.STORAGE_SCOPE?.trim() || undefined;
const resolveNrpcScope = (): string | undefined =>
	getCurrentStorageScope() ?? pinnedStorageScope;
(globalThis as any).__NRPC_SCOPE_RESOLVER__ = resolveNrpcScope;
(globalThis as any).__NRPC_WORKSPACE_RESOLVER__ = resolveNrpcScope;

if (!existsSync(runtimeMapPath)) {
	throw new Error(`Runtime map not found: ${runtimeMapPath}`);
}

const runtimeMap = readRuntimeMap(runtimeMapPath);
const runtimeConfig = readRuntimeConfig(
	process.env.CONFIG_PATH || resolve(appRoot, "config.json"),
);
const runtimeMicrofrontends = resolveRuntimeMicrofrontends(runtimeConfig);

// Print the full effective configuration at startup for every container role.
// (The MS transport connection-pool prints its own state from the storage layer
// — it must not be imported here or the native libtransport would be pulled into
// the UI bundle.)
const containerRole = process.env.RT_RUNTIMES
	? "RT"
	: runtimeMap.spa?.plugin || runtimeMap.landing?.plugin
		? "UI"
		: "MS";
printSettings(`container=${containerRole}`);

const runtimeCacheConfig = runtimeMap.cache
	? {
			url: runtimeMap.cache.url,
			keyPrefix: runtimeMap.cache.keyPrefix,
			defaultTtlSeconds: runtimeMap.cache.ssrTtlSeconds,
		}
	: null;

const runtimeCache: CacheAdapter | undefined = runtimeCacheConfig
	? createValkeyCache(runtimeCacheConfig)
	: undefined;
const logBridge = installBackendLogBridge({
	serviceBaseUrl: servicesBaseUrl,
	source: "back.runtime",
	storageScope: pinnedStorageScope,
});

const pluginEntries: Array<{
	key: string;
	path: string;
	plugin: (cfg: any) => any;
	mount: "root" | "services";
}> = [];
const startupTasks: Array<{ name: string; task: () => Promise<void> }> = [];
const shutdownTasks: Array<{ name: string; task: () => Promise<void> }> = [];
const enabledRuntimes = resolveEnabledRuntimes();
for (const [key, mappedPath] of Object.entries(runtimeMap.services || {})) {
	if (enabledRuntimes && !enabledRuntimes.has(key)) continue;
	const pluginPath = mappedPath.startsWith("/")
		? mappedPath
		: resolve(appRoot, mappedPath);
	// NOTE: all microservices share one process here, so a single bad plugin must
	// NOT crash the whole pod — log and skip it instead (the others keep serving).
	if (!existsSync(pluginPath)) {
		console.error("[runtime] mapped plugin file does not exist:", pluginPath);
		continue;
	}
	let plugin: (cfg: any) => any;
	try {
		plugin = await importPlugin(pluginPath);
	} catch (error) {
		console.error("[runtime] plugin import failed:", pluginPath, error);
		continue;
	}
	// The plugin's own `mount` export is the single source of truth. The path
	// check is only a
	// fallback for plugins that don't declare it (runtime plugins).
	const declaredMount = (plugin as { mount?: "root" | "services" }).mount;
	const mount =
		declaredMount ??
		(pluginPath.includes("/plugins/runtimes/") ||
		pluginPath.includes("/back/runtimes/")
			? "root"
			: "services");
	pluginEntries.push({ key, path: pluginPath, plugin, mount });
}

const servicePaths: Record<string, string> = {};
for (const { key } of pluginEntries) {
	const name = key.split("/")[1];
	if (name) servicePaths[name] = resolve(dataRoot, name);
}

const pluginConfig = {
	dbPath: dataRoot,
	dataDir: dataRoot,
	cache: runtimeCache,
	valkey: runtimeCache,
	registerStartupTask: (name: string, task: () => Promise<void>) => {
		startupTasks.push({ name, task });
	},
	registerShutdownTask: (name: string, task: () => Promise<void>) => {
		shutdownTasks.push({ name, task });
	},
	runWithContext: (context: any, callback: () => any) =>
		// Boundary: nrpc passes the scope as `workspace` on the wire — map it to
		// our single `scope` here.
		runWithRequestScopeContext(
			{
				scope: context?.scope ?? context?.workspace,
				headers: context?.headers,
			},
			callback,
		),
	...loadAiProvidersFromEnv(),
	servicePaths,
};

if (runtimeCache) {
	shutdownTasks.push({
		name: "valkey:close",
		task: async () => {
			runtimeCache.close();
		},
	});
}

const serveStatic = async (dir: string, path: string) => {
	const requested = path === "/" ? "/index.html" : path;
	const file = Bun.file(resolve(dir, `.${requested}`));
	if (await file.exists()) return file;
	const fallback = Bun.file(resolve(dir, "index.html"));
	if (await fallback.exists()) return fallback;
	return null;
};

const serveFile = async (
	absPath: string,
	request?: Request,
	options: { cacheControl?: string } = {},
) => {
	const file = Bun.file(absPath);
	if (!(await file.exists())) return new Response("Not Found", { status: 404 });
	const accept = request?.headers.get("accept-encoding") ?? "";
	const cacheControl = options.cacheControl ?? "no-store";
	if (accept.includes("br")) {
		const brFile = Bun.file(absPath + ".br");
		if (await brFile.exists()) {
			const ct = file.type || "application/octet-stream";
			return new Response(brFile, {
				headers: {
					"Content-Type": ct,
					"Content-Encoding": "br",
					"Cache-Control": cacheControl,
				},
			});
		}
	}
	return new Response(file, {
		headers: {
			"Content-Type": file.type || "application/octet-stream",
			"Cache-Control": cacheControl,
		},
	});
};

const frontDir = resolve(appRoot, "dist/front");
const frontVendorDir = resolve(frontDir, "vendor");
const mfDir = resolve(appRoot, "dist/mf");
const landingPublicDir = resolve(appRoot, "front", "landing", "public");
const frontLocalesDir = resolve(appRoot, "front", "front-core", "locales");
const storeWorkersDir = resolve(
	appRoot,
	"front",
	"libraries",
	"store-workers",
	"dist",
);
const hasFront = (() => {
	try {
		return statSync(join(frontDir, "index.html")).isFile();
	} catch {
		return false;
	}
})();

const app = new Elysia()
	.use(cors({ origin: true }))
	.onRequest(({ request }) => {
		// Bind the request's storage scope for the whole async execution so SSR
		// and the shared asset cache resolve the same tenant the request targets
		// the edge-injected scope header (cloud) or the STORAGE_SCOPE pin
		// (mono/multi serve one tenant), never mapped from the Host. If neither
		// resolves, downstream storage calls fail loudly.
		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});
		const scope = resolveRequestScopeFromHeaders(headers, pinnedStorageScope);
		enterRequestScopeContext({ scope, headers });
	})
	.onAfterHandle(({ set }) => {
		// Override Vary: * set by CORS plugin — it prevents browser caching
		// of static assets loaded via <script type="module"> (Sec-Fetch-Mode: cors)
		if (set.headers["vary"] === "*") {
			set.headers["vary"] = "Accept-Encoding";
		}
	})
	.onError(({ error, path, code }) => {
		logBridge.enqueue({
			level: logBridge.level.error,
			code: logBridge.code.httpHandlerError,
			message: `[${code}] ${path}: ${error instanceof Error ? error.stack || error.message : String(error)}`,
		});
	})
	.get("/health", () => ({
		status: "ok",
		plugins: pluginEntries.length,
		timestamp: Date.now(),
	}))
	.get("/cache/blob/*", async ({ request, set }) => {
		if (!runtimeCache) {
			set.status = 404;
			return { error: "Cache is not configured" };
		}

		const pathname = new URL(request.url).pathname;
		const encodedKey = pathname.slice("/cache/blob/".length);
		const cacheKey = decodeURIComponent(encodedKey);
		if (!cacheKey || !cacheKey.startsWith(`${runtimeCache.keyPrefix}:`)) {
			set.status = 400;
			return { error: "Invalid cache key" };
		}

		const bytes = await runtimeCache.getBytes(cacheKey);
		if (!bytes) {
			set.status = 404;
			return { error: "Cache entry not found" };
		}

		return new Response(toArrayBuffer(bytes), {
			headers: {
				"Content-Type": "application/octet-stream",
				"Cache-Control": "no-store",
			},
		});
	})
	.post("/cache/blob", async ({ request, set }) => {
		if (!runtimeCache) {
			set.status = 404;
			return { error: "Cache is not configured" };
		}

		const bytes = new Uint8Array(await request.arrayBuffer());
		const cacheKey = runtimeCache.buildKey(
			"client-upload",
			crypto.randomUUID(),
		);
		await runtimeCache.setBytes(cacheKey, bytes, CACHE_BLOB_TTL_SECONDS);
		return { cacheKey, sizeBytes: bytes.byteLength };
	})
	.use(
		createRuntimeImagesPlugin({
			servicesBaseUrl,
			serviceToken: process.env.SERVICE_TOKEN,
			cacheControl: process.env.IMAGE_CACHE_CONTROL,
			fallbackScope: pinnedStorageScope,
		}),
	);

for (const p of pluginEntries.filter((entry) => entry.mount === "root")) {
	try {
		app.use(p.plugin(pluginConfig));
	} catch (err) {
		console.error("[runtime] root plugin load failed:", p.path, err);
	}
}

app.group("/services", (api) => {
	for (const p of pluginEntries.filter((entry) => entry.mount === "services")) {
		try {
			api.use(p.plugin(pluginConfig));
		} catch (err) {
			console.error("[runtime] service plugin load failed:", p.path, err);
		}
	}
	return api;
});

app
	.get("/vendor/*", async ({ params, request }) =>
		serveFile(resolve(frontVendorDir, params["*"] || ""), request),
	)
	.get("/mf/:name.js", async ({ params, request }) =>
		serveFile(resolve(mfDir, `${params.name}.js`), request, {
			cacheControl: "no-store",
		}),
	)
	.get("/front-core.js", async ({ request }) =>
		serveFile(resolve(frontDir, "index.js"), request),
	)
	.get("/front-core.css", async ({ request }) =>
		serveFile(resolve(frontDir, "index.css"), request),
	)
	.get("/favicon.svg", async () =>
		serveFile(resolve(landingPublicDir, "favicon.svg")),
	)
	.get("/locales/*", async ({ params }) =>
		serveFile(resolve(frontLocalesDir, params["*"] || "")),
	)
	// Web Worker for chunked store uploads (mf-assistants/services.ts loads it via
	// `new URL("../../../../libraries/store-workers/dist/store.worker.js", import.meta.url)`,
	// which resolves to /libraries/store-workers/dist/* off the /mf bundle URL).
	// Served as a plain static asset, exactly like /vendor and /locales — same
	// route the SPA plugin already exposes, so the landing-served container has it too.
	.get("/libraries/store-workers/dist/*", async ({ params, request }) =>
		serveFile(resolve(storeWorkersDir, params["*"] || ""), request),
	);

if (hasFront) {
	app
		.get("/console", async () => Bun.file(join(frontDir, "index.html")))
		.get("/console/*", async ({ params }) => {
			const result = await serveStatic(frontDir, `/${params["*"] || ""}`);
			return result ?? new Response("Not Found", { status: 404 });
		});
}

// Demo "Admin login" entry point. Fail-closed: only when this tenant opts in via
// LANDING_DEMO_MODE=true do we mint a short, sandboxed demo session (limited
// `demo` preset, bound to the tenant STORAGE_SCOPE) and hand it to the front via
// the token query param the SSR bootstrap consumes. On any other tenant the same
// code just forwards to the normal sign-in splash — no token, no hole.
app.get("/demo-login", async () => {
	const redirect = (location: string) =>
		new Response(null, { status: 302, headers: { location } });
	if (process.env.LANDING_DEMO_MODE !== "true") {
		return redirect("/console");
	}
	try {
		const auth = createAuthServiceClient({ baseUrl: servicesBaseUrl });
		const { token } = await auth.createDemoSession();
		return redirect(`/console?token=${encodeURIComponent(token)}`);
	} catch (error) {
		console.error("[demo-login] failed to mint demo session", error);
		return redirect("/console");
	}
});

// SPA plugin — vendor libs, front-core, microfrontends
const spaPluginPath =
	runtimeMap.spa?.plugin ??
	(existsSync(resolve(pluginsRoot, "spa/plugin.js"))
		? resolve(pluginsRoot, "spa/plugin.js")
		: resolve(projectDir, "front/spa/src/plugin.ts"));
if (existsSync(spaPluginPath)) {
	const spaPlugin = await importPlugin(spaPluginPath);
	app.use(
		spaPlugin({
			production: true,
			cache: runtimeCache,
			microfrontends: runtimeMicrofrontends,
		}),
	);
}

if (runtimeMap.landing?.plugin) {
	const landingPluginPath = runtimeMap.landing.plugin.startsWith("/")
		? runtimeMap.landing.plugin
		: resolve(appRoot, runtimeMap.landing.plugin);
	if (!existsSync(landingPluginPath)) {
		throw new Error(`Landing plugin file does not exist: ${landingPluginPath}`);
	}
	const landingPlugin = await importPlugin(landingPluginPath);
	app.use(
		landingPlugin({
			production: true,
			publicDir: resolve(projectDir, "front", "landing", "public"),
			microfrontends: runtimeMicrofrontends,
			// Storage Valkey adapter — the /maps SVG plugin get/puts rendered maps here.
			cache: runtimeCache,
		}),
	);
}

for (let i = 0; i < startupTasks.length; i++) {
	const startupTask = startupTasks[i];
	const startedAt = Date.now();
	console.log(
		`[runtime] Init ${i + 1}/${startupTasks.length} start: ${startupTask.name}`,
	);
	try {
		await startupTask.task();
		console.log(
			`[runtime] Init ${i + 1}/${startupTasks.length} done: ${startupTask.name} (${Date.now() - startedAt}ms)`,
		);
	} catch (error) {
		console.error(
			`[runtime] Init ${i + 1}/${startupTasks.length} failed: ${startupTask.name}`,
			error,
		);
		throw error;
	}
}

let shuttingDown = false;
const runShutdown = async (reason: string) => {
	if (shuttingDown) {
		return;
	}
	shuttingDown = true;
	console.log(`[runtime] Shutdown start (${reason})`);

	try {
		if (typeof (app as any).stop === "function") {
			(app as any).stop();
		}
	} catch (error) {
		console.error("[runtime] Failed to stop HTTP listener", error);
	}

	for (let i = shutdownTasks.length - 1; i >= 0; i--) {
		const shutdownTask = shutdownTasks[i];
		const startedAt = Date.now();
		console.log(
			`[runtime] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} start: ${shutdownTask.name}`,
		);
		try {
			await shutdownTask.task();
			console.log(
				`[runtime] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} done: ${shutdownTask.name} (${Date.now() - startedAt}ms)`,
			);
		} catch (error) {
			console.error(
				`[runtime] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} failed: ${shutdownTask.name}`,
				error,
			);
		}
	}

	console.log("[runtime] Shutdown complete");
	await logBridge.flushNow();
};

process.once("SIGTERM", () => {
	void runShutdown("SIGTERM").finally(() => process.exit(0));
});
process.once("SIGINT", () => {
	void runShutdown("SIGINT").finally(() => process.exit(0));
});

app.listen({ port, hostname: "0.0.0.0" });
console.log(
	`[converged-app] http://localhost:${port} plugins=${pluginEntries.length}`,
);
