import { AsyncLocalStorage } from "node:async_hooks";

export const REQUEST_SCOPE_HEADER = "scope";
export const REQUEST_SCOPE_HEADER_ALT = "x-scope";
export const STORAGE_SCOPE_HEADER = "storage-scope";
export const STORAGE_SCOPE_HEADER_ALT = "x-storage-scope";

export interface RequestScopeContext {
	workspace?: string;
	scope?: string;
	headers?: Record<string, string | undefined>;
}

const storage = new AsyncLocalStorage<RequestScopeContext>();

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

export function resolveRequestScopeFromHeaders(
	headers: Record<string, string | undefined> | undefined,
	fallbackScope?: string,
): string | undefined {
	return (
		normalizeScope(readHeader(headers, STORAGE_SCOPE_HEADER)) ??
		normalizeScope(readHeader(headers, STORAGE_SCOPE_HEADER_ALT)) ??
		normalizeScope(readHeader(headers, REQUEST_SCOPE_HEADER)) ??
		normalizeScope(readHeader(headers, REQUEST_SCOPE_HEADER_ALT)) ??
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
	return context?.scope ?? context?.workspace;
}

export function runWithRequestScopeContext<T>(
	context: RequestScopeContext,
	callback: () => T,
): T {
	return storage.run(context, callback);
}
