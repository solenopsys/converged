import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, dirname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
	if (normalized.startsWith("workflows/") || normalized.startsWith("data/")) {
		return ensureTsPath(normalized);
	}
	return ensureTsPath(`wf-${normalized}`);
}

function kebabCase(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/[_\s]+/g, "-")
		.toLowerCase();
}

function workflowPathToName(path: string): string {
	return basename(path)
		.replace(/^wf-/, "")
		.replace(/\.[cm]?[tj]sx?$/, "");
}

function isWorkflowPath(path: string): boolean {
	if (!/\.[cm]?[tj]sx?$/.test(path)) return false;
	return basename(path).startsWith("wf-");
}

function workflowSourceToNames(path: string, content: string): string[] {
	const names = new Set<string>();
	for (const match of content.matchAll(/\bexport\s+class\s+([A-Za-z0-9_]+)Workflow\b/g)) {
		names.add(kebabCase(match[1]));
	}
	if (names.size === 0) {
		names.add(workflowPathToName(path));
	}
	return Array.from(names);
}

function workflowPathMatchesName(path: string, workflowName: string): boolean {
	return workflowPathToName(path) === workflowName;
}

function toModuleUrl(mime: "application/typescript" | "text/javascript", source: string): string {
	return URL.createObjectURL(new Blob([source], { type: mime }));
}

function toDataModuleUrl(path: string, hash: string, content: string): string {
	const sourceUrl = `\n//# sourceURL=ms-scripts://${path}`;
	const cacheKey = `\n// rt-script-hash:${hash}`;
	return toModuleUrl("application/typescript", content + sourceUrl + cacheKey);
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

	return toModuleUrl("text/javascript", source);
}

function resolveRuntimePackageSpecifier(specifier: string): string | undefined {
	if (specifier.startsWith("@rt/")) {
		return resolveRuntimePackageSpecifier(`rt/${specifier.slice("@rt/".length)}`);
	}
	if (specifier.startsWith("rt/providers/")) {
		return `converged-runtime/providers/${specifier.slice("rt/providers/".length)}`;
	}
	if (specifier === "rt/converged/dag-api") {
		return "converged-runtime/dag-api";
	}
	if (specifier === "rt/converged/providers") {
		return "converged-runtime/providers";
	}
	if (specifier.startsWith("rt/converged/providers/")) {
		return `converged-runtime/providers/${specifier.slice("rt/converged/providers/".length)}`;
	}
	if (specifier === "rt/club/dag-types") {
		return "club-runtime/dag-types";
	}
	if (specifier === "rt/club/providers") {
		return "club-runtime/providers";
	}
	if (specifier.startsWith("rt/club/providers/")) {
		return `club-runtime/providers/${specifier.slice("rt/club/providers/".length)}`;
	}
	if (specifier === "rt/club/vars") {
		return "club-runtime/vars";
	}
	if (specifier.startsWith("rt/club/lib/")) {
		return `club-runtime/lib/${specifier.slice("rt/club/lib/".length)}`;
	}
	return undefined;
}

function runtimeSpecifierToPath(packageSpecifier: string, projectDir: string): string | undefined {
	const packageRoots: Record<string, string[]> = {
		"club-runtime": [
			"back/runtime/club-workflows",
			"back/runtime/workflows",
		],
		"converged-runtime": [
			"back/runtime/converged-workflows",
			"back/runtime/workflows",
		],
	};

	for (const [packageName, roots] of Object.entries(packageRoots)) {
		const prefix = `${packageName}/`;
		if (!packageSpecifier.startsWith(prefix)) continue;

		const subpath = packageSpecifier.slice(prefix.length);
		const candidates = roots.flatMap((root) => {
			if (subpath === "dag-api") return [resolve(projectDir, root, "dag-api.ts")];
			if (subpath === "dag-types") return [resolve(projectDir, root, "dag-types.ts")];
			if (subpath === "providers") {
				return [
					resolve(projectDir, root, "providers/index.js"),
					resolve(projectDir, root, "providers/index.ts"),
				];
			}
			if (subpath.startsWith("providers/")) {
				const providerPath = subpath.slice("providers/".length);
				return [
					resolve(projectDir, root, "providers", `${providerPath}.js`),
					resolve(projectDir, root, "providers", `${providerPath}.ts`),
				];
			}
			if (subpath === "vars") return [resolve(projectDir, root, "vars.ts")];
			if (subpath.startsWith("lib/")) {
				return [resolve(projectDir, root, "lib", `${subpath.slice("lib/".length)}.ts`)];
			}
			return [];
		});

		return candidates.find((path) => existsSync(path)) ?? candidates[0];
	}

	return undefined;
}

function resolveRuntimeModuleUrl(packageSpecifier: string): string {
	try {
		return import.meta.resolve(packageSpecifier);
	} catch {
		// `club-runtime` is the child project runtime when converged-runtime is reused as a parent package.
	}

	const projectDirs = [process.env.PROJECT_DIR, process.env.CHILD_PROJECT_DIR]
		.filter((value): value is string => typeof value === "string" && value.length > 0);
	for (const projectDir of projectDirs) {
		const path = runtimeSpecifierToPath(packageSpecifier, projectDir);
		if (path) return pathToFileURL(path).href;
	}

	throw new Error(`Cannot resolve runtime package module: ${packageSpecifier}`);
}

function pickWorkflowCtor(module: any, workflowName: string): WorkflowCtor | undefined {
	if (typeof module?.default === "function") return module.default as WorkflowCtor;
	if (typeof module?.Workflow === "function") return module.Workflow as WorkflowCtor;
	if (typeof module?.WORKFLOW === "function") return module.WORKFLOW as WorkflowCtor;

	const list = Array.isArray(module?.WORKFLOWS) ? module.WORKFLOWS : [];
	const match = list.find((entry: any) => entry?.name === workflowName && typeof entry?.ctor === "function");
	if (match?.ctor) return match.ctor;

	const expectedCtorName = `${workflowName
		.split("-")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")}Workflow`;
	if (typeof module?.[expectedCtorName] === "function") {
		return module[expectedCtorName] as WorkflowCtor;
	}

	for (const [name, value] of Object.entries(module)) {
		if (name.endsWith("Workflow") && typeof value === "function") {
			return value as WorkflowCtor;
		}
	}
	return undefined;
}

export class RuntimeScriptResolver {
	private readonly client: ScriptsServiceClient;
	private readonly checkIntervalMs: number;
	private readonly modules = new Map<string, CachedModule>();
	private readonly workflowPaths = new Map<string, string>();
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
			specifier.startsWith("@rt/") ||
			specifier.startsWith("rt/") ||
			specifier.startsWith("nodes/") ||
			specifier.startsWith("workflows/") ||
			specifier.startsWith("scripts/") ||
			specifier.startsWith("./") ||
			specifier.startsWith("../")
		);
	}

	private async resolveSpecifierUrl(specifier: string, importerPath: string): Promise<string> {
		const rtSpecifier = specifier.startsWith("@rt/")
			? `rt/${specifier.slice("@rt/".length)}`
			: specifier;

		if (rtSpecifier === "rt/dag-api") return toEnvModuleUrl("dag-api");
		if (rtSpecifier === "rt/engines/dag") return toEnvModuleUrl("engines/dag");
		if (rtSpecifier === "rt/providers") return toEnvModuleUrl("providers");
		const runtimePackageSpecifier = resolveRuntimePackageSpecifier(specifier);
		if (runtimePackageSpecifier) {
			return resolveRuntimeModuleUrl(runtimePackageSpecifier);
		}
		if (specifier.startsWith("rt/") || specifier.startsWith("@rt/")) {
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
		if (specifier.startsWith("nodes/")) {
			const rootDir = dirname(importerPath);
			if (basename(importerPath).startsWith("wf-")) {
				return ensureTsPath(normalizeResolvedScriptPath(join(rootDir, specifier)));
			}
		}
		return ensureTsPath(normalizeScriptPath(specifier));
	}

	async resolveWorkflowCtor(workflowName: string): Promise<WorkflowCtor | undefined> {
		const path = await this.resolveWorkflowPath(workflowName);
		if (!path) return undefined;
		const module = await this.import(path);
		return pickWorkflowCtor(module, workflowName);
	}

	private async resolveWorkflowPath(workflowName: string): Promise<string | undefined> {
		let path = this.workflowPaths.get(workflowName);
		if (path) return path;

		await this.listWorkflowNames();
		path = this.workflowPaths.get(workflowName);
		if (path) return path;

		const hashMap = await this.client.getHashMap();
		for (const candidate of Object.keys(hashMap).sort()) {
			if (isWorkflowPath(candidate) && workflowPathMatchesName(candidate, workflowName)) {
				this.workflowPaths.set(workflowName, candidate);
				return candidate;
			}
		}

		const fallback = workflowNameToPath(workflowName);
		const fallbackHash = (await this.client.getHash(fallback)).hash;
		if (fallbackHash) {
			this.workflowPaths.set(workflowName, fallback);
			return fallback;
		}

		return undefined;
	}

	async listWorkflowNames(): Promise<string[]> {
		const hashMap = await this.client.getHashMap();
		this.workflowPaths.clear();

		for (const path of Object.keys(hashMap).sort()) {
			if (!isWorkflowPath(path)) continue;
			const file = await this.client.readScript(path);
			for (const name of workflowSourceToNames(path, file.content)) {
				this.workflowPaths.set(name, path);
			}
		}

		return Array.from(this.workflowPaths.keys()).sort();
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
