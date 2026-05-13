import { AsyncLocalStorage } from "node:async_hooks";
import {
	setWorkspaceContextResolver,
	type WorkspaceContext,
} from "./workspace-context-registry";

export const NRPC_WORKSPACE_HEADER = "workspace";
export const NRPC_WORKSPACE_HEADER_ALT = "x-workspace";
export const NRPC_SCOPE_HEADER = "scope";
export const NRPC_SCOPE_HEADER_ALT = "x-scope";

let storage: AsyncLocalStorage<WorkspaceContext> | undefined;

function getStorage(): AsyncLocalStorage<WorkspaceContext> {
	if (!storage) {
		storage = new AsyncLocalStorage<WorkspaceContext>();
		setWorkspaceContextResolver(() => storage?.getStore());
	}
	return storage;
}

function normalize(value: string | undefined): string | undefined {
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

export function resolveWorkspaceFromHeaders(
	headers: Record<string, string | undefined> | undefined,
	headerName: string = NRPC_WORKSPACE_HEADER,
): string | undefined {
	return (
		normalize(readHeader(headers, headerName)) ??
		normalize(readHeader(headers, NRPC_WORKSPACE_HEADER)) ??
		normalize(readHeader(headers, NRPC_WORKSPACE_HEADER_ALT))
	);
}

export function resolveScopeFromHeaders(
	headers: Record<string, string | undefined> | undefined,
	fallbackScope?: string,
	headerName: string = NRPC_SCOPE_HEADER,
): string | undefined {
	return (
		normalize(readHeader(headers, headerName)) ??
		normalize(readHeader(headers, NRPC_SCOPE_HEADER)) ??
		normalize(readHeader(headers, NRPC_SCOPE_HEADER_ALT)) ??
		normalize(fallbackScope)
	);
}

export function getCurrentWorkspace(): string | undefined {
	return storage?.getStore()?.workspace;
}

export function getCurrentWorkspaceContext(): WorkspaceContext | undefined {
	return storage?.getStore();
}

export function runWithWorkspaceContext<T>(
	context: WorkspaceContext,
	callback: () => T,
): T {
	return getStorage().run(context, callback);
}
