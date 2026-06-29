import { resolveRequestScopeFromHeaders } from "back-core";

type HeaderLike = Record<string, string | undefined> | undefined;

function hostLikeScopeToTenant(value: string): string | undefined {
	const normalized = value.trim().toLowerCase();
	if (!normalized.includes(".")) return undefined;

	const firstLabel = normalized.split(".")[0]?.trim();
	if (!firstLabel || firstLabel === "www") return undefined;
	return firstLabel;
}

// The storage scope is resolved at the edge (Traefik scope middleware injects it
// as a header). Legacy browser clients used to pass the public host in the
// `scope` query parameter; after scope routing moved to Kubernetes that value no
// longer exists in STORAGE_TENANT_SERVICES. Keep the bridge compatible by
// converting host-like query values to the storage scope.
export function resolveAudioGateScope(
	requestedScope: string | undefined,
	headers: HeaderLike,
): string | undefined {
	const explicit = requestedScope?.trim();
	const headerScope = resolveRequestScopeFromHeaders(headers);
	if (explicit) {
		if (hostLikeScopeToTenant(explicit)) {
			return headerScope ?? hostLikeScopeToTenant(explicit);
		}
		return explicit;
	}

	return headerScope;
}
