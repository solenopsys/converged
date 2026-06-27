import {
	resolveWorkspaceFromDomain,
	resolveWorkspaceFromHeaders,
} from "back-core/workspace-domain";

type HeaderLike = Record<string, string | undefined> | undefined;

export function resolveAudioGateScope(
	requestedScope: string | undefined,
	headers: HeaderLike,
): string | undefined {
	const explicit = requestedScope?.trim();
	if (explicit) {
		return resolveWorkspaceFromDomain(explicit) ?? explicit;
	}

	return resolveWorkspaceFromHeaders(headers);
}
