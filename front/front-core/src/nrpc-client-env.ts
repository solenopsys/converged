type NrpcClientEnv = {
	headers?: Record<string, string | undefined>;
};

declare global {
	var __NRPC_CLIENT_ENV__: NrpcClientEnv | undefined;
}

function isIpHost(hostname: string): boolean {
	return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function stripFirstDomainSegment(hostname: string): string {
	const normalized = hostname.trim().toLowerCase();
	if (!normalized || normalized === "localhost" || isIpHost(normalized)) {
		return normalized;
	}

	const parts = normalized.split(".").filter(Boolean);
	if (parts.length <= 2) return normalized;
	return parts.slice(1).join(".");
}

function resolveForwardedHost(): string | undefined {
	const location = globalThis.location;
	const hostname = stripFirstDomainSegment(location?.hostname ?? "");
	if (!hostname) return undefined;
	return location.port ? `${hostname}:${location.port}` : hostname;
}

const forwardedHost = resolveForwardedHost();
if (forwardedHost) {
	globalThis.__NRPC_CLIENT_ENV__ = {
		...globalThis.__NRPC_CLIENT_ENV__,
		headers: {
			...globalThis.__NRPC_CLIENT_ENV__?.headers,
			"x-forwarded-host": forwardedHost,
		},
	};
}
