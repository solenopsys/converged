import { AsyncLocalStorage } from "node:async_hooks";
import { resolveWorkspaceFromHeaders } from "./workspace-domain";

export const REQUEST_SCOPE_HEADER = "scope";
export const REQUEST_SCOPE_HEADER_ALT = "x-scope";
export const STORAGE_SCOPE_HEADER = "storage-scope";
export const STORAGE_SCOPE_HEADER_ALT = "x-storage-scope";
const REQUEST_SCOPE_STORAGE_GLOBAL_KEY = "__CONVERGED_REQUEST_SCOPE_STORAGE__";

export interface RequestScopeContext {
	workspace?: string;
	scope?: string;
	headers?: Record<string, string | undefined>;
}

const globalScopeStorage = globalThis as typeof globalThis & {
	[REQUEST_SCOPE_STORAGE_GLOBAL_KEY]?: AsyncLocalStorage<RequestScopeContext>;
};

const storage =
	globalScopeStorage[REQUEST_SCOPE_STORAGE_GLOBAL_KEY] ??=
		new AsyncLocalStorage<RequestScopeContext>();

function normalizeScope(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized || undefined;
}

function readHeader(
	headers: Record<string, string | undefined> | undefined,
	name: string,
): string | undefined {
	if (!headers || !name) return undefined;
	const normalizedName = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === normalizedName) return value;
	}
	return undefined;
}

function resolveWorkspaceScopeFromHeaders(
	headers: Record<string, string | undefined> | undefined,
): string | undefined {
	const explicit =
		normalizeScope(readHeader(headers, "workspace")) ??
		normalizeScope(readHeader(headers, "x-workspace"));
	if (explicit) return explicit;

	const host =
		readHeader(headers, "x-forwarded-host") ?? readHeader(headers, "host");
	if (!host) return undefined;

	return resolveWorkspaceFromHeaders(headers, {
		env: {
			WORKSPACE_DOMAIN_MAP: process.env.WORKSPACE_DOMAIN_MAP,
			NRPC_WORKSPACE_DOMAIN_MAP: process.env.NRPC_WORKSPACE_DOMAIN_MAP,
		},
	});
}

export function resolveRequestScopeFromHeaders(
	headers: Record<string, string | undefined> | undefined,
	fallbackScope?: string,
): string | undefined {
	return (
		normalizeScope(readHeader(headers, STORAGE_SCOPE_HEADER)) ??
		normalizeScope(readHeader(headers, STORAGE_SCOPE_HEADER_ALT)) ??
		normalizeScope(readHeader(headers, REQUEST_SCOPE_HEADER)) ??
		normalizeScope(readHeader(headers, REQUEST_SCOPE_HEADER_ALT)) ??
		normalizeScope(resolveWorkspaceScopeFromHeaders(headers)) ??
		normalizeScope(fallbackScope)
	);
}

export function getCurrentRequestContext(): RequestScopeContext | undefined {
	return storage.getStore();
}

export function getCurrentRequestScope(): string | undefined {
	return storage.getStore()?.scope;
}

export function getCurrentRequestWorkspace(): string | undefined {
	return storage.getStore()?.workspace;
}

export function getCurrentStorageScope(): string | undefined {
	const context = storage.getStore();
	return (
		context?.scope ??
		context?.workspace ??
		resolveRequestScopeFromHeaders(context?.headers)
	);
}

export function runWithRequestScopeContext<T>(
	context: RequestScopeContext,
	callback: () => T,
): T {
	return storage.run(context, callback);
}
