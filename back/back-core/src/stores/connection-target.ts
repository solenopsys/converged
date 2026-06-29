// Pure storage-connection-target resolution.
//
// IMPORTANT: this module must NOT statically import any *value* from
// "bun-transport" (only `import type` is allowed). It is imported by the UI
// runtime via the Valkey cache (server/bunRedisCache.ts) to resolve the cache
// host. Pulling a runtime symbol from "bun-transport" here would force the
// native libtransport-*.so to be dlopen()'d in the UI container.
//
// The storage host comes from ONE place: the STORAGE_TENANT_SERVICES mapping,
// keyed by scope. The scope itself is resolved at the edge (the per-tenant
// Traefik scope middleware injects it as a request header) or pinned via
// STORAGE_SCOPE — not mapped from the Host here. No prefix, no fixed-host
// variable — the mapping names the host directly.
import type { StorageConnectionTargetConfig as StorageConnectionConfig } from "bun-transport";
import { SettingsError, settings } from "../config/settings";

type TenantStorageEndpoint =
	| string
	| StorageConnectionConfig
	| { host: string; port?: number };
export type StorageConnectionTarget = string | StorageConnectionConfig;

export function parseStorageHost(
	host: string,
	port?: number,
): StorageConnectionConfig {
	if (host.startsWith("unix:")) {
		return { kind: "unix", socketPath: host.slice("unix:".length) };
	}
	const tcpHost = host.startsWith("tcp:") ? host.slice("tcp:".length) : host;

	const colonIndex = tcpHost.lastIndexOf(":");
	if (colonIndex > 0 && colonIndex < tcpHost.length - 1) {
		const parsedPort = Number.parseInt(tcpHost.slice(colonIndex + 1), 10);
		if (Number.isFinite(parsedPort) && parsedPort > 0) {
			return {
				kind: "tcp",
				host: tcpHost.slice(0, colonIndex),
				port: parsedPort,
			};
		}
	}

	if (port === undefined) {
		throw new SettingsError(
			`Storage endpoint "${host}" has no port; specify it in STORAGE_TENANT_SERVICES`,
		);
	}
	return { kind: "tcp", host: tcpHost, port };
}

function storageEndpointToTarget(
	endpoint: TenantStorageEndpoint,
): StorageConnectionTarget {
	if (typeof endpoint === "string") return parseStorageHost(endpoint);
	if ("kind" in endpoint) return endpoint;
	return parseStorageHost(endpoint.host, endpoint.port);
}

export function storageConnectionKey(config: StorageConnectionTarget): string {
	const normalized =
		typeof config === "string"
			? { kind: "unix" as const, socketPath: config }
			: config;
	return normalized.kind === "unix"
		? `unix:${normalized.socketPath}`
		: `tcp:${normalized.host}:${normalized.port}`;
}

// Storage is resolved per-tenant from the mapping, so every operation needs a
// scope (unless a single explicit scope is pinned via STORAGE_SCOPE).
export function isCloudStorageScopeRequired(): boolean {
	return !settings.storage.explicitScope();
}

export function resolveStorageConnectionTargetForScope(
	scope?: string,
): StorageConnectionTarget {
	const tenantServices =
		settings.storage.tenantServices<Record<string, TenantStorageEndpoint>>();

	const effectiveScope = scope ?? settings.storage.explicitScope();
	if (!effectiveScope) {
		throw new SettingsError(
			"Storage scope is required: pass the storage-scope/workspace header (injected by the edge scope middleware) or pin STORAGE_SCOPE",
		);
	}

	const endpoint = tenantServices[effectiveScope];
	if (!endpoint) {
		throw new SettingsError(
			`No storage endpoint for scope "${effectiveScope}" in STORAGE_TENANT_SERVICES`,
		);
	}
	return storageEndpointToTarget(endpoint);
}
