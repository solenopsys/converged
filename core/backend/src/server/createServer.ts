import { resolve } from "path";
import type { NrpcMessagingRuntime } from "nrpc/cluster";
import { installBackendLogBridge } from "./logBridge";
import { loadAiProvidersFromEnv } from "./envConfig";
import { getMsMessagingRuntime } from "./fujin-services";
import { registerMicroservices, type ServiceBinding } from "./service-registry";
import {
	enterWorkspaceContext,
	getCurrentStorageScope,
	resolveRequestScopeFromHeaders,
} from "../request-context";
import { resolveWorkspaceFromHeaders } from "../workspace-domain";
import { ServerApp, type ServerPlugin } from "./server-app";
export type { AiConfig } from "./envConfig";

export const CACHE_BLOB_TTL_SECONDS = 30 * 60;

export interface CacheAdapter {
	url: string;
	keyPrefix: string;
	defaultTtlSeconds: number;
	buildKey: (...segments: Array<string | number>) => string;
	get: (key: string) => Promise<string | null>;
	set: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
	getBytes: (key: string) => Promise<Uint8Array | null>;
	setBytes: (
		key: string,
		value: Uint8Array,
		ttlSeconds?: number,
	) => Promise<void>;
	del: (key: string) => Promise<void>;
	getJson: <T>(key: string) => Promise<T | null>;
	setJson: (key: string, value: unknown, ttlSeconds?: number) => Promise<void>;
	close: () => void;
}

export interface PluginConfig {
	dbPath: string;
	openai?: { key: string; model: string };
	claude?: { key: string; model: string };
	gemini?: { key: string; model: string };
	cache?: CacheAdapter;
	valkey?: CacheAdapter;
	registerStartupTask?: (name: string, task: () => Promise<void>) => void;
	registerShutdownTask?: (name: string, task: () => Promise<void>) => void;

	messagingRuntime?: NrpcMessagingRuntime;
	[key: string]: any;
}

export interface ServerConfig {
	name: string;
	port: number;
	dataDir: string;
	openai?: { key: string; model: string };
	claude?: { key: string; model: string };
	gemini?: { key: string; model: string };
	extraConfig?: Record<string, any>;
}

export type PluginFactory = ((
	config: PluginConfig,
) => ServerPlugin) & {
	mount?: "root" | "services";
};

export interface CreateServerOptions {
	config: ServerConfig;
	services?: ServiceBinding[];
	plugins: PluginFactory[];
	staticDir?: string;
}

function toModuleName(taskName: string): string {
	const [kind, rest] = taskName.split(":", 2);
	if (!rest) return taskName;
	if (kind === "nrpc") return rest;
	return `${kind}:${rest}`;
}

function collectActiveModules(taskNames: string[]): string[] {
	const modules: string[] = [];
	const seen = new Set<string>();
	for (const taskName of taskNames) {
		const moduleName = toModuleName(taskName);
		if (seen.has(moduleName)) continue;
		seen.add(moduleName);
		modules.push(moduleName);
	}
	return modules;
}

function configureNrpcClientEnv(env: {
	baseUrl?: string;
	serviceToken?: string;
}): void {
	const nrpcGlobal = globalThis as typeof globalThis & {
		__NRPC_CLIENT_ENV__?: {
			baseUrl?: string;
			serviceToken?: string;
			headers?: Record<string, string | undefined>;
		};
	};
	const current = nrpcGlobal.__NRPC_CLIENT_ENV__ ?? {};
	nrpcGlobal.__NRPC_CLIENT_ENV__ = {
		...current,
		...env,
		headers: current.headers,
	};
}

function configureNrpcScopeResolvers(): void {
	const pinnedStorageScope = process.env.STORAGE_SCOPE?.trim() || undefined;
	const resolveScope = (): string | undefined =>
		getCurrentStorageScope() ?? pinnedStorageScope;
	const nrpcGlobal = globalThis as typeof globalThis & {
		__NRPC_SCOPE_RESOLVER__?: () => string | undefined;
		__NRPC_WORKSPACE_RESOLVER__?: () => string | undefined;
	};
	nrpcGlobal.__NRPC_SCOPE_RESOLVER__ = resolveScope;
	nrpcGlobal.__NRPC_WORKSPACE_RESOLVER__ = resolveScope;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

export function loadConfigFromEnv(): ServerConfig {
	const ai = loadAiProvidersFromEnv();
	return {
		name: process.env.APP_NAME || "app",
		port: Number(process.env.PORT) || Number(process.env.SERVICES_PORT) || 3000,
		dataDir: process.env.DATA_DIR || "./data",
		...ai,
	};
}


export function createServer({
	config,
	services = [],
	plugins,
	staticDir,
}: CreateServerOptions) {
	configureNrpcClientEnv({
		baseUrl: `http://127.0.0.1:${config.port}/services`,
		serviceToken: process.env.SERVICE_TOKEN,
	});
	configureNrpcScopeResolvers();
	const configuredStorageScope = process.env.STORAGE_SCOPE?.trim() || undefined;

	const logBridge = installBackendLogBridge({
		serviceBaseUrl: `http://127.0.0.1:${config.port}/services`,
		source: "back.core",
		storageScope: configuredStorageScope,
	});
	const startupTasks: Array<{ name: string; task: () => Promise<void> }> = [];
	const shutdownTasks: Array<{ name: string; task: () => Promise<void> }> = [];
	let shuttingDown = false;
	let serverHandle: any = null;
	// The microservice host registers handlers on this runtime; UI hosts use the
	// same process runtime only for outbound NRPC calls. Configurator gives UI
	// `FUJIN_TARGET=ui`, so it never owns the `services` target.
	const messagingRuntime = getMsMessagingRuntime();

	const pluginConfig: PluginConfig = {
		dbPath: config.dataDir,
		openai: config.openai,
		claude: config.claude,
		gemini: config.gemini,
		messagingRuntime,
		registerStartupTask: (name, task) => {
			startupTasks.push({ name, task });
		},
		registerShutdownTask: (name, task) => {
			shutdownTasks.push({ name, task });
		},
		...config.extraConfig,
	};
	if (services.length > 0) {
		registerMicroservices(services, pluginConfig);
	}
	if (messagingRuntime) {
		// Service handlers are registered above. Start the transport before their
		// initialization and close it after their reverse-order shutdown.
		startupTasks.unshift({
			name: "nrpc:transport",
			task: () => messagingRuntime.start(),
		});
		shutdownTasks.unshift({
			name: "nrpc:transport",
			task: () => messagingRuntime.close(),
		});
	}
	if (pluginConfig.cache) {
		shutdownTasks.push({
			name: "cache:close",
			task: async () => {
				pluginConfig.cache?.close();
			},
		});
	}

	console.log(`Creating server: ${config.name}`);
	console.log(`  Port: ${config.port}`);
	console.log(`  Data directory: ${resolve(config.dataDir)}`);
	console.log(`  Microservices: ${services.length}`);

	const app = new ServerApp()
		.onRequest(({ request }) => {
			// Bind the request's storage scope for the whole async execution so
			// direct routes (/cache/blob, /images, SSR) resolve the same tenant the
			// request targets. In production the scope arrives as an edge-injected
			// edge, so we fall back to resolving Host → scope from a local
			// WORKSPACE_DOMAIN_MAP env — the ONE place that mapping still lives, and
			// a no-op in production where the env is unset. nrpc service calls bind
			// their own scope via runWithContext; this covers everything else.
			const headers: Record<string, string> = {};
			request.headers.forEach((value, key) => {
				headers[key] = value;
			});
			const scope =
				resolveRequestScopeFromHeaders(headers) ??
				resolveWorkspaceFromHeaders(headers);
			if (process.env.LOG_SCOPE === "true") {
				console.debug(
					`[scope] ${request.method} ${new URL(request.url).pathname} → ${scope ?? "(none)"}`,
				);
			}
			enterWorkspaceContext({ scope, headers });
		})
		.onAfterHandle(({ set }) => {
			set.headers["Access-Control-Allow-Origin"] = "*";
			set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Storage-Scope, Workspace, Scope";
			set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS";
			set.headers["Vary"] = "Accept-Encoding";
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
			name: config.name,
			timestamp: Date.now(),
		}))
		.get("/cache/blob/*", async ({ request, set }) => {
			if (!pluginConfig.cache) {
				set.status = 404;
				return { error: "Cache is not configured" };
			}

			const pathname = new URL(request.url).pathname;
			const encodedKey = pathname.slice("/cache/blob/".length);
			const cacheKey = decodeURIComponent(encodedKey);
			if (
				!cacheKey ||
				!cacheKey.startsWith(`${pluginConfig.cache.keyPrefix}:`)
			) {
				set.status = 400;
				return { error: "Invalid cache key" };
			}

			const bytes = await pluginConfig.cache.getBytes(cacheKey);
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
			if (!pluginConfig.cache) {
				set.status = 404;
				return { error: "Cache is not configured" };
			}

			const bytes = new Uint8Array(await request.arrayBuffer());
			const cacheKey = pluginConfig.cache.buildKey(
				"client-upload",
				crypto.randomUUID(),
			);
			await pluginConfig.cache.setBytes(
				cacheKey,
				bytes,
				CACHE_BLOB_TTL_SECONDS,
			);
			return { cacheKey, sizeBytes: bytes.byteLength };
		});

	for (let i = 0; i < plugins.length; i++) {
		const plugin = plugins[i];
		if (plugin.mount !== "root") continue;
		try {
			const pluginInstance = plugin(pluginConfig);
			if (!pluginInstance) {
				console.warn("[back-core] Skipping empty root plugin");
				continue;
			}
			app.use(pluginInstance as any);
		} catch (err) {
			console.error(
				`[back-core] Root plugin #${i + 1} failed to register and was skipped`,
				err,
			);
		}
	}

	app.group("/services", (api) => {
		for (let i = 0; i < plugins.length; i++) {
			const plugin = plugins[i];
			if (plugin.mount === "root") continue;
			try {
				const pluginInstance = plugin(pluginConfig);
				if (!pluginInstance) {
					console.warn("[back-core] Skipping empty plugin");
					continue;
				}
				api.use(pluginInstance as any);
			} catch (err) {
				console.error(
					`[back-core] Plugin #${i + 1} failed to register and was skipped`,
					err,
				);
				continue;
			}
		}
		return api;
	});

	// Serve static files if directory specified
	if (staticDir) {
		app.get("/*", async ({ params, set }) => {
			const filePath = params["*"] || "index.html";
			const fullPath = `${staticDir}/${filePath}`;

			const file = Bun.file(fullPath);
			if (await file.exists()) {
				return file;
			}

			// SPA fallback
			const indexFile = Bun.file(`${staticDir}/index.html`);
			if (await indexFile.exists()) {
				return indexFile;
			}

			set.status = 404;
			return { error: "Not found" };
		});
	}

	return {
		app,
		start: async () => {
			const runShutdown = async (reason: string) => {
				if (shuttingDown) {
					return;
				}
				shuttingDown = true;

				console.log(`[back-core] Shutdown start (${reason})`);

				try {
					if (serverHandle && typeof serverHandle.stop === "function") {
						serverHandle.stop();
					} else if (typeof (app as any).stop === "function") {
						(app as any).stop();
					}
				} catch (error) {
					console.error("[back-core] Failed to stop HTTP listener", error);
				}

				for (let i = shutdownTasks.length - 1; i >= 0; i--) {
					const shutdownTask = shutdownTasks[i];
					const startedAt = Date.now();
					console.log(
						`[back-core] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} start: ${shutdownTask.name}`,
					);
					try {
						await shutdownTask.task();
						console.log(
							`[back-core] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} done: ${shutdownTask.name} (${Date.now() - startedAt}ms)`,
						);
					} catch (error) {
						console.error(
							`[back-core] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} failed: ${shutdownTask.name}`,
							error,
						);
					}
				}

				console.log("[back-core] Shutdown complete");
				await logBridge.flushNow();
			};

			process.once("SIGTERM", () => {
				void runShutdown("SIGTERM").finally(() => process.exit(0));
			});
			process.once("SIGINT", () => {
				void runShutdown("SIGINT").finally(() => process.exit(0));
			});

			const activeModules = collectActiveModules(
				startupTasks.map((t) => t.name),
			);
			if (activeModules.length > 0) {
				console.log(
					`Active modules (${activeModules.length}): ${activeModules.join(", ")}`,
				);
			}

			for (let i = 0; i < startupTasks.length; i++) {
				const startupTask = startupTasks[i];
				try {
					await startupTask.task();
				} catch (error) {
					console.error(
						`[back-core] Init ${i + 1}/${startupTasks.length} failed: ${startupTask.name}`,
						error,
					);
					throw error;
				}
			}

			serverHandle = app.listen(
				{ port: config.port, hostname: "0.0.0.0" },
				() => {
					console.log(
						`Server ${config.name} running on http://localhost:${config.port}`,
					);
				},
			);
			return app;
		},
		stop: async (reason = "manual") => {
			// Reuse the same code path as signal-based shutdown.
			if (shuttingDown) {
				return;
			}
			shuttingDown = true;
			console.log(`[back-core] Shutdown start (${reason})`);
			try {
				if (serverHandle && typeof serverHandle.stop === "function") {
					serverHandle.stop();
				} else if (typeof (app as any).stop === "function") {
					(app as any).stop();
				}
			} catch (error) {
				console.error("[back-core] Failed to stop HTTP listener", error);
			}
			for (let i = shutdownTasks.length - 1; i >= 0; i--) {
				const shutdownTask = shutdownTasks[i];
				try {
					await shutdownTask.task();
				} catch (error) {
					console.error(
						`[back-core] Shutdown task failed: ${shutdownTask.name}`,
						error,
					);
				}
			}
			console.log("[back-core] Shutdown complete");
			await logBridge.flushNow();
		},
	};
}
