// Pure storage-connection-target resolution.
//
// IMPORTANT: this module must NOT statically import any *value* from
// "bun-transport" (only `import type` is allowed). It is imported by the UI
// runtime via the Valkey cache (server/bunRedisCache.ts) to resolve the cache
// host. Pulling a runtime symbol from "bun-transport" here would force the
// native libtransport-*.so to be dlopen()'d in the UI container.
//
// All env access goes through the settings controller — no fallbacks. A missing
// or ambiguous storage configuration throws (the container should have already
// failed its startup checklist).
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

	// Port not encoded in the host string → take the canonical STORAGE_PORT.
	// This is the required env value, not a literal fallback.
	return { kind: "tcp", host: tcpHost, port: port ?? settings.storage.port() };
}

function storageEndpointToTarget(
	endpoint: TenantStorageEndpoint,
	port: number,
): StorageConnectionTarget {
	if (typeof endpoint === "string") return parseStorageHost(endpoint, port);
	if ("kind" in endpoint) return endpoint;
	return parseStorageHost(endpoint.host, endpoint.port ?? port);
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

// True when the deployment resolves storage per-tenant (cloud): tcp transport
// with a service prefix and no fixed host / explicit scope. In that mode a scope
// must be supplied for every storage operation.
export function isCloudStorageScopeRequired(): boolean {
	if (settings.storage.transport() !== "tcp") return false;
	if (settings.storage.host()) return false;
	if (settings.storage.explicitScope()) return false;
	return Boolean(settings.storage.servicePrefix());
}

export function resolveStorageConnectionTargetForScope(
	scope?: string,
): StorageConnectionTarget {
	if (settings.storage.transport() === "unix") {
		const socketPath = settings.storage.socketPath();
		if (!socketPath) {
			throw new SettingsError(
				"STORAGE_TRANSPORT=unix requires STORAGE_SOCKET_PATH",
			);
		}
		return socketPath;
	}

	const port = settings.storage.port();
	const effectiveScope = scope ?? settings.storage.explicitScope();

	const tenantServices =
		settings.storage.tenantServices<Record<string, TenantStorageEndpoint>>();
	if (tenantServices && effectiveScope) {
		const endpoint = tenantServices[effectiveScope];
		if (endpoint) return storageEndpointToTarget(endpoint, port);
	}

	const host = settings.storage.host();
	if (host) return { kind: "tcp", host, port };

	const prefix = settings.storage.servicePrefix();
	if (prefix) {
		if (!effectiveScope) {
			throw new SettingsError(
				"Storage scope is required: pass workspace/scope headers (Host/x-forwarded-host → WORKSPACE_DOMAIN_MAP)",
			);
		}
		return { kind: "tcp", host: `${prefix}-${effectiveScope}`, port };
	}

	throw new SettingsError(
		"No storage host source configured: set STORAGE_HOST or STORAGE_SERVICE_PREFIX",
	);
}
