export interface WorkspaceContext {
	workspace?: string;
	scope?: string;
	user?: string;
	auth?: string;
	headers?: Record<string, string | undefined>;
}

type WorkspaceContextResolver = () => WorkspaceContext | undefined;

const WORKSPACE_CONTEXT_RESOLVER_KEY =
	"__CONVERGED_NRPC_WORKSPACE_CONTEXT_RESOLVER__";
const runtimeGlobal = globalThis as typeof globalThis & {
	[WORKSPACE_CONTEXT_RESOLVER_KEY]?: WorkspaceContextResolver;
};

export function setWorkspaceContextResolver(
	resolver: WorkspaceContextResolver,
): void {
	runtimeGlobal[WORKSPACE_CONTEXT_RESOLVER_KEY] = resolver;
}

export function getRegisteredWorkspaceContext(): WorkspaceContext | undefined {
	return runtimeGlobal[WORKSPACE_CONTEXT_RESOLVER_KEY]?.();
}

export function getCurrentWorkspaceContext(): WorkspaceContext | undefined {
	return getRegisteredWorkspaceContext();
}

export function getCurrentWorkspace(): string | undefined {
	return getCurrentWorkspaceContext()?.workspace;
}
