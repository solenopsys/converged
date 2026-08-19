import { enterWorkspaceContext, getCurrentWorkspaceContext } from "nrpc";

export { enterWorkspaceContext };

export const REQUEST_SCOPE_HEADER = "scope";
export const REQUEST_SCOPE_HEADER_ALT = "x-scope";
export const STORAGE_SCOPE_HEADER = "storage-scope";
export const STORAGE_SCOPE_HEADER_ALT = "x-storage-scope";

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
		normalizeScope(readHeader(headers, "workspace")) ??
		normalizeScope(readHeader(headers, "x-workspace")) ??
		normalizeScope(fallbackScope)
	);
}

// Convenience reader for a whole Request — used by direct (non-nrpc) routes such
// as the gallery image proxy that receive the edge-injected scope header.
export function resolveRequestScopeFromRequest(
	request: Request,
	fallbackScope?: string,
): string | undefined {
	const headers: Record<string, string> = {};
	request.headers.forEach((value, key) => {
		headers[key] = value;
	});
	return resolveRequestScopeFromHeaders(headers, fallbackScope);
}

// The single accessor for the current scope. Resolves from the bound context,
// falling back to the request headers (scope/workspace header → domain map).
export function getCurrentStorageScope(): string | undefined {
	const context = getCurrentWorkspaceContext();
	return context?.scope ?? context?.workspace ?? resolveRequestScopeFromHeaders(context?.headers);
}

export const getCurrentRequestScope = getCurrentStorageScope;
