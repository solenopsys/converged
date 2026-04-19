import { createHash } from "node:crypto";
import { dirname, join, normalize } from "node:path";
import { createScriptsServiceClient, type ScriptsServiceClient } from "g-scripts";
import * as DagApi from "./workflows/dag-api";
import * as DagEngine from "./engines/dag";
import * as Providers from "./workflows/providers";

export type WorkflowCtor = new (ctx: any, id?: string) => { start(params: any): Promise<void> };

type CachedModule = {
	hash: string;
	module: any;
	url: string;
	checkedAt: number;
};

type ScriptResolverOptions = {
	client?: ScriptsServiceClient;
	baseUrl?: string;
	checkIntervalMs?: number;
	refreshIntervalMs?: number;
	registerShutdownTask?: (name: string, task: () => Promise<void>) => void;
};

const DEFAULT_PAGE_SIZE = 500;
const RT_ENV_KEY = "__rtScriptEnv";
const SCRIPT_IMPORT_RE =
	/\b(import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

declare global {
	var __rtScriptEnv: {
		dagApi: typeof DagApi;
		dagEngine: typeof DagEngine;
		providers: typeof Providers;
	} | undefined;
}

function normalizeScriptPath(path: string): string {
	const normalized = path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
	if (!normalized || normalized.startsWith("../") || normalized.includes("/../")) {
		throw new Error(`Invalid script path: ${path}`);
	}
	return normalized;
}

function normalizeResolvedScriptPath(path: string): string {
	const normalized = normalize(path).replace(/\\/g, "/").replace(/^\/+/, "");
	return normalizeScriptPath(normalized);
}

function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function ensureTsPath(path: string): string {
	return /\.[cm]?[tj]sx?$/.test(path) ? path : `${path}.ts`;
}

function workflowNameToPath(name: string): string {
	const normalized = normalizeScriptPath(name);
	if (normalized.startsWith("workflows/")) {
		return ensureTsPath(normalized);
	}
	return ensureTsPath(`workflows/${normalized}`);
}

function workflowPathToName(path: string): string {
	return path
		.replace(/^workflows\//, "")
		.replace(/\.[cm]?[tj]sx?$/, "");
}

function toDataModuleUrl(path: string, hash: string, content: string): string {
	const sourceUrl = `\n//# sourceURL=ms-scripts://${path}`;
	return `data:text/typescript;charset=utf-8,${encodeURIComponent(content + sourceUrl)}#${encodeURIComponent(hash)}`;
}

function toEnvModuleUrl(alias: "dag-api" | "engines/dag" | "providers"): string {
	const source =
		alias === "dag-api"
			? [
					`const env = globalThis.${RT_ENV_KEY}.dagApi;`,
					"export const processTemplate = env.processTemplate;",
					"export const ProviderState = env.ProviderState;",
				].join("\n")
		: alias === "engines/dag"
			? [
					`const env = globalThis.${RT_ENV_KEY}.dagEngine;`,
					"export const Workflow = env.Workflow;",
					"export const NodeProcessor = env.NodeProcessor;",
				].join("\n")
			: [
					`const env = globalThis.${RT_ENV_KEY}.providers;`,
					"export const PROVIDER_DEFINITIONS = env.PROVIDER_DEFINITIONS;",
					"export const getProviderDefinition = env.getProviderDefinition;",
					"export const initProvidersPool = env.initProvidersPool;",
					"export const getProvidersPool = env.getProvidersPool;",
				].join("\n");

	return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#rt-${alias}`;
}

function pickWorkflowCtor(module: any, workflowName: string): WorkflowCtor | undefined {
	if (typeof module?.default === "function") return module.default as WorkflowCtor;
	if (typeof module?.Workflow === "function") return module.Workflow as WorkflowCtor;
	if (typeof module?.WORKFLOW === "function") return module.WORKFLOW as WorkflowCtor;

	const list = Array.isArray(module?.WORKFLOWS) ? module.WORKFLOWS : [];
	const match = list.find((entry: any) => entry?.name === workflowName && typeof entry?.ctor === "function");
	return match?.ctor;
}

export class RuntimeScriptResolver {
	private readonly client: ScriptsServiceClient;
	private readonly checkIntervalMs: number;
	private readonly modules = new Map<string, CachedModule>();
	private refreshTimer?: ReturnType<typeof setInterval>;

	constructor(options: ScriptResolverOptions = {}) {
		globalThis.__rtScriptEnv = {
			dagApi: DagApi,
			dagEngine: DagEngine,
			providers: Providers,
		};

		this.client = options.client ?? createScriptsServiceClient({ baseUrl: options.baseUrl });
		this.checkIntervalMs = Math.max(0, options.checkIntervalMs ?? 0);

		const refreshIntervalMs = Number(options.refreshIntervalMs ?? 0);
		if (Number.isFinite(refreshIntervalMs) && refreshIntervalMs > 0) {
			this.refreshTimer = setInterval(() => {
				void this.invalidateChangedScripts().catch((error) => {
					console.error("[runtime] scripts hash refresh failed", error);
				});
			}, refreshIntervalMs);

			options.registerShutdownTask?.("runtime:scripts-refresh", async () => {
				clearInterval(this.refreshTimer!);
			});
		}
	}

	async import(path: string): Promise<any> {
		const scriptPath = normalizeScriptPath(path);
		const cached = this.modules.get(scriptPath);
		const now = Date.now();

		if (cached && this.checkIntervalMs > 0 && now - cached.checkedAt < this.checkIntervalMs) {
			return cached.module;
		}

		const remoteHash = (await this.client.getHash(scriptPath)).hash;
		if (cached && remoteHash && cached.hash === remoteHash) {
			cached.checkedAt = now;
			return cached.module;
		}

		const { hash, url } = await this.loadModuleUrl(scriptPath, remoteHash);
		const module = await import(url);

		this.modules.set(scriptPath, {
			hash,
			module,
			url,
			checkedAt: now,
		});

		return module;
	}

	private async loadModuleUrl(path: string, knownHash?: string): Promise<{ hash: string; url: string }> {
		const scriptPath = normalizeScriptPath(path);
		const cached = this.modules.get(scriptPath);
		const now = Date.now();

		if (cached && knownHash && cached.hash === knownHash) {
			cached.checkedAt = now;
			return { hash: cached.hash, url: cached.url };
		}

		const file = await this.client.readScript(scriptPath);
		const hash = knownHash ?? hashContent(file.content);
		const transformed = await this.rewriteImports(scriptPath, file.content);
		return { hash, url: toDataModuleUrl(scriptPath, hash, transformed) };
	}

	private async rewriteImports(importerPath: string, content: string): Promise<string> {
		const replacements: Array<{ start: number; end: number; value: string }> = [];

		for (const match of content.matchAll(SCRIPT_IMPORT_RE)) {
			const specifier = match[2] ?? match[3];
			if (!specifier || !this.shouldResolveSpecifier(specifier)) continue;

			const start = match.index! + match[0].lastIndexOf(specifier);
			const end = start + specifier.length;
			replacements.push({
				start,
				end,
				value: await this.resolveSpecifierUrl(specifier, importerPath),
			});
		}

		if (replacements.length === 0) return content;

		let result = "";
		let cursor = 0;
		for (const replacement of replacements) {
			result += content.slice(cursor, replacement.start);
			result += replacement.value;
			cursor = replacement.end;
		}
		result += content.slice(cursor);
		return result;
	}

	private shouldResolveSpecifier(specifier: string): boolean {
		return (
			specifier.startsWith("rt/") ||
			specifier.startsWith("nodes/") ||
			specifier.startsWith("workflows/") ||
			specifier.startsWith("scripts/") ||
			specifier.startsWith("./") ||
			specifier.startsWith("../")
		);
	}

	private async resolveSpecifierUrl(specifier: string, importerPath: string): Promise<string> {
		if (specifier === "rt/dag-api") return toEnvModuleUrl("dag-api");
		if (specifier === "rt/engines/dag") return toEnvModuleUrl("engines/dag");
		if (specifier === "rt/providers") return toEnvModuleUrl("providers");
		if (specifier.startsWith("rt/")) {
			throw new Error(`Unknown RT script alias "${specifier}" imported by ${importerPath}`);
		}

		const scriptPath = this.resolveScriptImportPath(specifier, importerPath);
		const remoteHash = (await this.client.getHash(scriptPath)).hash;
		const { url } = await this.loadModuleUrl(scriptPath, remoteHash);
		return url;
	}

	private resolveScriptImportPath(specifier: string, importerPath: string): string {
		if (specifier.startsWith("./") || specifier.startsWith("../")) {
			return ensureTsPath(normalizeResolvedScriptPath(join(dirname(importerPath), specifier)));
		}
		if (specifier.startsWith("scripts/")) {
			return ensureTsPath(normalizeScriptPath(specifier.slice("scripts/".length)));
		}
		return ensureTsPath(normalizeScriptPath(specifier));
	}

	async resolveWorkflowCtor(workflowName: string): Promise<WorkflowCtor | undefined> {
		const path = workflowNameToPath(workflowName);
		const module = await this.import(path);
		return pickWorkflowCtor(module, workflowName);
	}

	async listWorkflowNames(): Promise<string[]> {
		const names: string[] = [];
		let offset = 0;

		while (true) {
			const page = await this.client.listScripts({ offset, limit: DEFAULT_PAGE_SIZE });
			const items = Array.isArray(page.items) ? page.items : [];

			for (const item of items) {
				const path = typeof item?.path === "string" ? item.path : "";
				if (path.startsWith("workflows/") && /\.[cm]?[tj]sx?$/.test(path)) {
					names.push(workflowPathToName(path));
				}
			}

			if (items.length < DEFAULT_PAGE_SIZE) break;
			offset += DEFAULT_PAGE_SIZE;
		}

		return Array.from(new Set(names)).sort();
	}

	async invalidateChangedScripts(): Promise<void> {
		if (this.modules.size === 0) return;

		const hashMap = await this.client.getHashMap();
		for (const [path, cached] of this.modules) {
			if (hashMap[path] !== cached.hash) {
				this.modules.delete(path);
			}
		}
	}
}
