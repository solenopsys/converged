import {
	StorageConnection,
	type StorageConnectionConfig,
	type StorageConnectionOptions,
	type StoreTypeKey as TransportStoreTypeKey,
} from "bun-transport";
import { ColumnStore } from "../engines/column/column-store";
import { FileStore } from "../engines/files/file-store";
import { JsonStore } from "../engines/json/json-store";
import { KVStore } from "../engines/kv/kv-store";
import { SqlStore } from "../engines/sql/sql-store";
import { VectorStore } from "../engines/vector/vector-store";
import type { Migration } from "../migrations";
import { getCurrentStorageScope } from "../request-context";
import type { Store, StoreSizeInfo } from "./types";
import { StoreType } from "./types";

type TenantStorageEndpoint =
	| string
	| StorageConnectionConfig
	| { host: string; port?: number };
export type StorageConnectionTarget = string | StorageConnectionConfig;

const DEFAULT_STORAGE_TCP_PORT = 9000;
const DEFAULT_STORAGE_SCOPE = "__default__";

let tenantStorageServicesRaw: string | undefined;
let tenantStorageServicesCache: Record<string, TenantStorageEndpoint> = {};

function readTenantStorageServices(): Record<string, TenantStorageEndpoint> {
	if (!process.env.STORAGE_TENANT_SERVICES) return {};
	if (tenantStorageServicesRaw === process.env.STORAGE_TENANT_SERVICES) {
		return tenantStorageServicesCache;
	}

	tenantStorageServicesRaw = process.env.STORAGE_TENANT_SERVICES;
	try {
		const parsed = JSON.parse(process.env.STORAGE_TENANT_SERVICES) as Record<
			string,
			TenantStorageEndpoint
		>;
		tenantStorageServicesCache =
			parsed && typeof parsed === "object" && !Array.isArray(parsed)
				? parsed
				: {};
		return tenantStorageServicesCache;
	} catch {
		tenantStorageServicesCache = {};
		return tenantStorageServicesCache;
	}
}

function readTenantStorageEndpoint(
	scope?: string,
): TenantStorageEndpoint | undefined {
	const services = readTenantStorageServices();
	const tenant =
		scope ||
		process.env.STORAGE_SCOPE ||
		process.env.STORAGE_TENANT ||
		"default";
	return services[tenant] ?? services.default;
}

function normalizeTcpPort(port: number | string | undefined): number {
	const parsed =
		typeof port === "number" ? port : Number.parseInt(port || "", 10);
	return Number.isFinite(parsed) && parsed > 0
		? parsed
		: DEFAULT_STORAGE_TCP_PORT;
}

function parseStorageHost(
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

	return {
		kind: "tcp",
		host: tcpHost,
		port: normalizeTcpPort(port),
	};
}

function storageEndpointToTarget(
	endpoint: TenantStorageEndpoint,
): StorageConnectionTarget {
	if (typeof endpoint === "string") return parseStorageHost(endpoint);
	if ("kind" in endpoint) return endpoint;
	return parseStorageHost(endpoint.host, endpoint.port);
}

function storageConnectionKey(config: StorageConnectionTarget): string {
	const normalized =
		typeof config === "string"
			? { kind: "unix" as const, socketPath: config }
			: config;
	return normalized.kind === "unix"
		? `unix:${normalized.socketPath}`
		: `tcp:${normalized.host}:${normalized.port}`;
}

function discoverStorageHosts(): string[] {
	const prefix = process.env.STORAGE_SERVICE_PREFIX;
	if (!prefix) return [];
	const envPrefix = prefix.toUpperCase().replace(/-/g, "_") + "_";
	const envSuffix = "_SERVICE_HOST";
	const hosts: string[] = [];
	for (const key of Object.keys(process.env)) {
		if (key.startsWith(envPrefix) && key.endsWith(envSuffix)) {
			const mid = key.slice(envPrefix.length, -envSuffix.length);
			hosts.push(`${prefix}-${mid.toLowerCase().replace(/_/g, "-")}`);
		}
	}
	return hosts;
}

function readStorageConnectionConfig(): StorageConnectionTarget {
	const tenantEndpoint = readTenantStorageEndpoint();
	if (tenantEndpoint) {
		return storageEndpointToTarget(tenantEndpoint);
	}

	const transport =
		process.env.STORAGE_TRANSPORT || process.env.STORAGE_CONNECTION_KIND;
	if (transport === "tcp") {
		const discovered = discoverStorageHosts();
		return {
			kind: "tcp",
			host:
				process.env.STORAGE_TCP_HOST ||
				process.env.STORAGE_HOST ||
				discovered[0] ||
				"127.0.0.1",
			port: normalizeTcpPort(
				process.env.STORAGE_TCP_PORT || process.env.STORAGE_PORT,
			),
		};
	}
	return process.env.STORAGE_SOCKET_PATH || "/tmp/storage.sock";
}

function readStorageConnectionConfigForScope(
	scope?: string,
): StorageConnectionTarget {
	const tenantEndpoint = readTenantStorageEndpoint(scope);
	if (tenantEndpoint) {
		return storageEndpointToTarget(tenantEndpoint);
	}
	const prefix = process.env.STORAGE_SERVICE_PREFIX;
	const transport =
		process.env.STORAGE_TRANSPORT || process.env.STORAGE_CONNECTION_KIND;
	if (prefix && scope && transport === "tcp") {
		return {
			kind: "tcp",
			host: `${prefix}-${scope}`,
			port: normalizeTcpPort(
				process.env.STORAGE_TCP_PORT || process.env.STORAGE_PORT,
			),
		};
	}
	return readStorageConnectionConfig();
}

interface StoragePoolEntry {
	key: string;
	config: StorageConnectionTarget;
	conn: StorageConnection;
	refs: number;
}

interface StoragePoolLease {
	key: string;
	conn: StorageConnection;
}

export class StorageConnectionPool {
	private readonly entries = new Map<string, StoragePoolEntry>();
	private readonly defaultConfig: StorageConnectionTarget;

	constructor(
		defaultConfig: StorageConnectionTarget = readStorageConnectionConfig(),
		private readonly options?: StorageConnectionOptions,
	) {
		this.defaultConfig = defaultConfig;
	}

	addHost(host: string, port?: number): StorageConnection {
		return this.addConnection(parseStorageHost(host, port));
	}

	addConnection(config: StorageConnectionTarget): StorageConnection {
		const key = storageConnectionKey(config);
		const existing = this.entries.get(key);
		if (existing) return existing.conn;

		const conn = new StorageConnection(config, this.options);
		this.entries.set(key, { key, config, conn, refs: 0 });
		return conn;
	}

	getConnection(host?: string): StorageConnection {
		const config = host ? parseStorageHost(host) : this.defaultConfig;
		const key = storageConnectionKey(config);
		return this.entries.get(key)?.conn ?? this.addConnection(config);
	}

	getConnectionEntry(host?: string): StoragePoolLease {
		const config = host ? parseStorageHost(host) : this.defaultConfig;
		const key = storageConnectionKey(config);
		return {
			key,
			conn: this.entries.get(key)?.conn ?? this.addConnection(config),
		};
	}

	getConnectionForScope(scope?: string): StoragePoolLease {
		const config = scope
			? readStorageConnectionConfigForScope(scope)
			: this.defaultConfig;
		const key = storageConnectionKey(config);
		return {
			key,
			conn: this.entries.get(key)?.conn ?? this.addConnection(config),
		};
	}

	acquire(host?: string): StoragePoolLease {
		const config = host ? parseStorageHost(host) : this.defaultConfig;
		const key = storageConnectionKey(config);
		let entry = this.entries.get(key);
		if (!entry) {
			const conn = new StorageConnection(config, this.options);
			entry = { key, config, conn, refs: 0 };
			this.entries.set(key, entry);
		}
		entry.refs += 1;
		return { key, conn: entry.conn };
	}

	release(key: string): void {
		const entry = this.entries.get(key);
		if (!entry || entry.refs === 0) return;
		entry.refs -= 1;
	}

	disconnect(host: string): boolean {
		const config = parseStorageHost(host);
		return this.disconnectKey(storageConnectionKey(config));
	}

	disconnectKey(key: string): boolean {
		const entry = this.entries.get(key);
		if (!entry) return false;
		entry.conn.close();
		this.entries.delete(key);
		return true;
	}

	disconnectAll(): void {
		for (const entry of this.entries.values()) {
			entry.conn.close();
		}
		this.entries.clear();
	}

	closeStoreOnAll(msName: string, storeName: string): void {
		for (const entry of this.entries.values()) {
			try {
				entry.conn.close_store(msName, storeName);
			} catch {
				// A scoped storage may not have this store open yet.
			}
		}
	}

	list(): Array<{ key: string; refs: number }> {
		return Array.from(this.entries.values()).map((entry) => ({
			key: entry.key,
			refs: entry.refs,
		}));
	}
}

export const storageConnectionPool = new StorageConnectionPool();

export function addStorageConnection(
	host: string,
	port?: number,
): StorageConnection {
	return storageConnectionPool.addHost(host, port);
}

export function getStorageConnection(host?: string): StorageConnection {
	return storageConnectionPool.getConnection(host);
}

export function getStorageConnectionForScope(
	scope?: string,
): StorageConnection {
	return storageConnectionPool.getConnectionForScope(scope).conn;
}

export function resolveStorageConnectionTargetForScope(
	scope?: string,
): StorageConnectionTarget {
	return scope
		? readStorageConnectionConfigForScope(scope)
		: readStorageConnectionConfig();
}

export function disconnectStorageConnection(host: string): boolean {
	return storageConnectionPool.disconnect(host);
}

export function disconnectAllStorageConnections(): void {
	storageConnectionPool.disconnectAll();
}

export function listStorageConnections(): Array<{ key: string; refs: number }> {
	return storageConnectionPool.list();
}

const STORE_DEBUG_ENABLED =
	process.env.STORE_DEBUG === "1" || process.env.STORE_DEBUG === "true";

function logStoreDebug(message: string, meta?: Record<string, unknown>) {
	if (!STORE_DEBUG_ENABLED) return;
	if (meta) {
		console.log(`[stores] ${message}`, meta);
		return;
	}
	console.log(`[stores] ${message}`);
}

function elapsedMs(startedAt: number): number {
	return Date.now() - startedAt;
}

function createStore(
	conn: StorageConnection,
	msName: string,
	storeDir: string,
	type: StoreType,
	migrations: (new (store: Store) => Migration)[],
): Store {
	logStoreDebug("prepare", { msName, store: storeDir, type });

	if (type === StoreType.KVS) {
		return new KVStore(conn, msName, storeDir, migrations);
	}
	if (type === StoreType.SQL) {
		return new SqlStore(conn, msName, storeDir, migrations);
	}
	if (type === StoreType.FILES) {
		return new FileStore(conn, msName, storeDir, migrations);
	}
	if (type === StoreType.JSON) {
		return new JsonStore(conn, msName, storeDir, migrations);
	}
	if (type === StoreType.COLUMN) {
		return new ColumnStore(conn, msName, storeDir, migrations);
	}
	if (type === StoreType.VECTOR) {
		return new VectorStore(conn, msName, storeDir, migrations);
	}

	throw new Error(`Store type ${type} not implemented`);
}

function toTransportStoreType(type: StoreType): TransportStoreTypeKey {
	switch (type) {
		case StoreType.SQL:
			return "sql";
		case StoreType.KVS:
			return "kv";
		case StoreType.COLUMN:
			return "column";
		case StoreType.VECTOR:
			return "vector";
		case StoreType.FILES:
		case StoreType.JSON:
			return "files";
		case StoreType.GRAPH:
			return "graph";
		default:
			throw new Error(`Store type ${type} not implemented`);
	}
}

function fromTransportStoreType(
	type: TransportStoreTypeKey,
	declaredType: StoreType,
): StoreType {
	if (declaredType === StoreType.JSON && type === "files") {
		return StoreType.JSON;
	}
	switch (type) {
		case "sql":
			return StoreType.SQL;
		case "kv":
			return StoreType.KVS;
		case "column":
			return StoreType.COLUMN;
		case "vector":
			return StoreType.VECTOR;
		case "files":
			return StoreType.FILES;
		case "graph":
			return StoreType.GRAPH;
		default:
			throw new Error(`Transport store type ${type} not implemented`);
	}
}

const STORE_OPERATION_METHODS = new Set<PropertyKey>([
	"getSize",
	"getManifest",
	"recordMigration",
	"createArchive",
	"execSql",
	"querySql",
	"kvPut",
	"kvGet",
	"kvDelete",
	"kvList",
	"kvGetRange",
	"kvCompact",
	"dumpCreate",
	"filePut",
	"fileGet",
	"fileDelete",
	"fileList",
]);

function createRequestScopedStorageConnection(
	fixedStorageHost?: string,
): StorageConnection {
	const openedStores = new Map<string, Set<string>>();

	const storeKey = (msName: string, storeName: string) =>
		`${msName}/${storeName}`;

	const resolveConnection = (): StoragePoolLease => {
		if (fixedStorageHost) {
			return storageConnectionPool.getConnectionEntry(fixedStorageHost);
		}
		return storageConnectionPool.getConnectionForScope(
			getCurrentStorageScope(),
		);
	};

	const markOpen = (
		connectionKey: string,
		msName: string,
		storeName: string,
	) => {
		let opened = openedStores.get(connectionKey);
		if (!opened) {
			opened = new Set<string>();
			openedStores.set(connectionKey, opened);
		}
		opened.add(storeKey(msName, storeName));
	};

	const ensureStoreOpen = (
		lease: StoragePoolLease,
		msName: string,
		storeName: string,
	) => {
		const key = storeKey(msName, storeName);
		const opened = openedStores.get(lease.key);
		if (opened?.has(key)) return;
		lease.conn.open(msName, storeName);
		markOpen(lease.key, msName, storeName);
	};

	return new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === "open") {
					return (msName: string, storeName: string) => {
						const lease = resolveConnection();
						const result = lease.conn.open(msName, storeName);
						markOpen(lease.key, msName, storeName);
						return result;
					};
				}

				if (prop === "create") {
					return (
						msName: string,
						storeName: string,
						storeType: TransportStoreTypeKey,
					) => {
						const lease = resolveConnection();
						const result = lease.conn.create(msName, storeName, storeType);
						markOpen(lease.key, msName, storeName);
						return result;
					};
				}

				if (prop === "close_store") {
					return (msName: string, storeName: string) => {
						storageConnectionPool.closeStoreOnAll(msName, storeName);
						const key = storeKey(msName, storeName);
						for (const opened of openedStores.values()) {
							opened.delete(key);
						}
					};
				}

				return (...args: any[]) => {
					const lease = resolveConnection();
					const method = (lease.conn as any)[prop];
					if (typeof method !== "function") return method;
					if (STORE_OPERATION_METHODS.has(prop)) {
						ensureStoreOpen(lease, args[0], args[1]);
					}
					return method.apply(lease.conn, args);
				};
			},
		},
	) as StorageConnection;
}

export abstract class StoreControllerAbstract {
	protected stores: { [key: string]: Store } = {};
	protected conn: StorageConnection;
	private readonly initializedScopes = new Set<string>();
	private readonly scopeInitPromises = new Map<string, Promise<void>>();

	constructor(
		protected msName: string,
		storageHost?: string,
	) {
		try {
			this.conn = createRequestScopedStorageConnection(storageHost);
		} catch (error) {
			const wrapped = new Error(
				`storage transport init failed for "${msName}" (${storageHost || "default"}): ` +
					`${error instanceof Error ? error.message : String(error)}`,
			) as Error & { cause?: unknown };
			wrapped.cause = error;
			throw wrapped;
		}
	}

	abstract init(): Promise<void>;
	abstract destroy(): Promise<void>;

	async ensureCurrentScopeReady(): Promise<void> {
		const scope = getCurrentStorageScope();
		if (!scope) return;
		const key = scope || DEFAULT_STORAGE_SCOPE;
		if (this.initializedScopes.has(key)) return;

		const existing = this.scopeInitPromises.get(key);
		if (existing) return existing;

		const initPromise = (async () => {
			await this.startAll();
			await this.migrateAll();
			this.initializedScopes.add(key);
		})().finally(() => {
			this.scopeInitPromises.delete(key);
		});
		this.scopeInitPromises.set(key, initPromise);
		return initPromise;
	}

	async startAll() {
		for (const [name, store] of Object.entries(this.stores)) {
			const startedAt = Date.now();
			logStoreDebug("open:start", { msName: this.msName, store: name });
			try {
				await store.open();
				logStoreDebug("open:done", {
					msName: this.msName,
					store: name,
					durationMs: elapsedMs(startedAt),
				});
			} catch (error) {
				logStoreDebug("open:failed", {
					msName: this.msName,
					store: name,
					durationMs: elapsedMs(startedAt),
					error: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		}
	}

	async closeAll() {
		for (const [name, store] of Object.entries(this.stores)) {
			const startedAt = Date.now();
			logStoreDebug("close:start", { msName: this.msName, store: name });
			try {
				await store.close();
				logStoreDebug("close:done", {
					msName: this.msName,
					store: name,
					durationMs: elapsedMs(startedAt),
				});
			} catch (error) {
				logStoreDebug("close:failed", {
					msName: this.msName,
					store: name,
					durationMs: elapsedMs(startedAt),
					error: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		}
	}

	async migrateAll() {
		for (const [name, store] of Object.entries(this.stores)) {
			const startedAt = Date.now();
			logStoreDebug("migrate:start", { msName: this.msName, store: name });
			try {
				await store.migrate();
				logStoreDebug("migrate:done", {
					msName: this.msName,
					store: name,
					durationMs: elapsedMs(startedAt),
				});
			} catch (error) {
				logStoreDebug("migrate:failed", {
					msName: this.msName,
					store: name,
					durationMs: elapsedMs(startedAt),
					error: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		}
	}

	async addStore(
		name: string,
		type: StoreType,
		migrations: (new (store: Store) => Migration)[],
	): Promise<Store> {
		const declaredTransportType = toTransportStoreType(type);
		// create is idempotent on the server side: opens existing or creates new
		this.conn.create(this.msName, name, declaredTransportType);
		const manifest = this.conn.getManifest(this.msName, name);
		const actualType = fromTransportStoreType(manifest.storeType, type);

		this.stores[name] = createStore(
			this.conn,
			this.msName,
			name,
			actualType,
			migrations,
		);
		return this.stores[name];
	}

	async getStoreSize(
		storeName: string,
		msName: string = this.msName,
	): Promise<bigint> {
		return this.conn.getSize(msName, storeName);
	}

	async listOpenStoreKeys(msName?: string): Promise<string[]> {
		const keys = this.conn.listStores();
		if (!msName) {
			return keys;
		}
		const prefix = `${msName}/`;
		return keys.filter((key) => key.startsWith(prefix));
	}

	async listOpenStoreNames(msName: string = this.msName): Promise<string[]> {
		const keys = await this.listOpenStoreKeys(msName);
		return keys
			.map((key) => this.parseStoreKey(key))
			.filter(
				(parsed): parsed is { msName: string; store: string } =>
					parsed !== null,
			)
			.map((parsed) => parsed.store);
	}

	async getOpenStoresSize(
		msName: string = this.msName,
	): Promise<StoreSizeInfo[]> {
		const keys = await this.listOpenStoreKeys(msName);
		const result: StoreSizeInfo[] = [];

		for (const key of keys) {
			const parsed = this.parseStoreKey(key);
			if (!parsed) continue;
			const sizeBytes = this.conn.getSize(parsed.msName, parsed.store);
			result.push({
				msName: parsed.msName,
				store: parsed.store,
				key,
				sizeBytes,
			});
		}

		return result;
	}

	private parseStoreKey(key: string): { msName: string; store: string } | null {
		const slashIndex = key.indexOf("/");
		if (slashIndex <= 0 || slashIndex === key.length - 1) {
			return null;
		}
		return {
			msName: key.slice(0, slashIndex),
			store: key.slice(slashIndex + 1),
		};
	}
}

export { createStore };
