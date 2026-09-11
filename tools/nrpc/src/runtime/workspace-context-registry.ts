export interface WorkspaceContext {
	workspace?: string;
	scope?: string;
	user?: string;
	auth?: string;
	/**
	 * Group access tags of the actor, taken from the verified token and never
	 * from the envelope — an envelope field is client-supplied, and a forged tag
	 * is a forged permission. The actor's own personal tag is not in here: it is
	 * derived from `user`, see `getCurrentAccessTags`.
	 */
	accessTags?: readonly string[];
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
