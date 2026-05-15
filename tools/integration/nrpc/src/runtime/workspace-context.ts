import {
	setWorkspaceContextResolver,
	type WorkspaceContext,
} from "./workspace-context-registry";

export const NRPC_WORKSPACE_HEADER = "workspace";
export const NRPC_WORKSPACE_HEADER_ALT = "x-workspace";
export const NRPC_SCOPE_HEADER = "scope";
export const NRPC_SCOPE_HEADER_ALT = "x-scope";

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

// Server-side storage — lazily initialized only in Node.js/Bun
// In browser environments this is always undefined (no-op)
type ALS = {
	getStore(): WorkspaceContext | undefined;
	run<T>(store: WorkspaceContext, fn: () => T): T;
};

let _storage: ALS | null = null;
let _storageInitialized = false;

function getStorage(): ALS | null {
	if (_storageInitialized) return _storage;
	_storageInitialized = true;
	try {
		// Indirect reference prevents Vite from statically analyzing the import
		const modName = ["node", "async_hooks"].join(":");
		// biome-ignore lint: intentional dynamic require for server-only code
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const mod = (typeof require !== "undefined" ? require(modName) : null) as
			| { AsyncLocalStorage: new <T>() => ALS }
			| null;
		if (mod?.AsyncLocalStorage) {
			_storage = new mod.AsyncLocalStorage<WorkspaceContext>();
			setWorkspaceContextResolver(() => _storage?.getStore());
		}
	} catch {
		// Browser or environments without async_hooks — storage stays null
	}
	return _storage;
}

export function getCurrentWorkspace(): string | undefined {
	return getStorage()?.getStore()?.workspace;
}

export function getCurrentWorkspaceContext(): WorkspaceContext | undefined {
	return getStorage()?.getStore();
}

export function runWithWorkspaceContext<T>(
	context: WorkspaceContext,
	callback: () => T,
): T {
	const storage = getStorage();
	if (storage) return storage.run(context, callback);
	return callback();
}
