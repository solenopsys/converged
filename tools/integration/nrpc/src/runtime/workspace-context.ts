import { AsyncLocalStorage } from "node:async_hooks";
import {
	REQUEST_SCOPE_HEADER,
	REQUEST_SCOPE_HEADER_ALT,
	resolveRequestScopeFromHeaders,
	runWithRequestScopeContext,
	STORAGE_SCOPE_HEADER,
	STORAGE_SCOPE_HEADER_ALT,
} from "back-core/request-context";
import {
	WORKSPACE_HEADER as NRPC_WORKSPACE_HEADER,
	WORKSPACE_HEADER_ALT as NRPC_WORKSPACE_HEADER_ALT,
	resolveWorkspaceFromHeaders as resolveWorkspaceFromBackHeaders,
} from "back-core/workspace-domain";
import {
	setWorkspaceContextResolver,
	type WorkspaceContext,
} from "./workspace-context-registry";

export {
	NRPC_WORKSPACE_HEADER,
	NRPC_WORKSPACE_HEADER_ALT,
	REQUEST_SCOPE_HEADER as NRPC_SCOPE_HEADER,
	REQUEST_SCOPE_HEADER_ALT as NRPC_SCOPE_HEADER_ALT,
	STORAGE_SCOPE_HEADER as NRPC_STORAGE_SCOPE_HEADER,
	STORAGE_SCOPE_HEADER_ALT as NRPC_STORAGE_SCOPE_HEADER_ALT,
};

const storage = new AsyncLocalStorage<WorkspaceContext>();
setWorkspaceContextResolver(() => storage.getStore());

export function resolveWorkspaceFromHeaders(
	headers: Record<string, string | undefined> | undefined,
	headerName: string = NRPC_WORKSPACE_HEADER,
): string | undefined {
	return resolveWorkspaceFromBackHeaders(headers, { headerName });
}

export function resolveScopeFromHeaders(
	headers: Record<string, string | undefined> | undefined,
	fallbackScope?: string,
): string | undefined {
	return resolveRequestScopeFromHeaders(headers, fallbackScope);
}

export function getCurrentWorkspace(): string | undefined {
	return storage.getStore()?.workspace;
}

export function getCurrentWorkspaceContext(): WorkspaceContext | undefined {
	return storage.getStore();
}

export function runWithWorkspaceContext<T>(
	context: WorkspaceContext,
	callback: () => T,
): T {
	return storage.run(context, () =>
		runWithRequestScopeContext(
			{
				workspace: context.workspace,
				scope: context.scope ?? context.workspace,
				headers: context.headers,
			},
			callback,
		),
	);
}
