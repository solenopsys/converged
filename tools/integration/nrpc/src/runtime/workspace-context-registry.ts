export interface WorkspaceContext {
	workspace?: string;
	scope?: string;
	headers?: Record<string, string | undefined>;
}

type WorkspaceContextResolver = () => WorkspaceContext | undefined;

let workspaceContextResolver: WorkspaceContextResolver | undefined;

export function setWorkspaceContextResolver(
	resolver: WorkspaceContextResolver,
): void {
	workspaceContextResolver = resolver;
}

export function getRegisteredWorkspaceContext(): WorkspaceContext | undefined {
	return workspaceContextResolver?.();
}

export function getCurrentWorkspaceContext(): WorkspaceContext | undefined {
	return getRegisteredWorkspaceContext();
}

export function getCurrentWorkspace(): string | undefined {
	return getCurrentWorkspaceContext()?.workspace;
}
