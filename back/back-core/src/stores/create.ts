import {
	NativeStorageConnectionPool,
	StorageConnection,
	type StorageConnectionOptions,
	type StoreTypeKey as TransportStoreTypeKey,
} from "bun-transport";
import { settings } from "../config/settings";
import { ColumnStore } from "../engines/column/column-store";
import { FileStore } from "../engines/files/file-store";
import { JsonStore } from "../engines/json/json-store";
import { KVStore } from "../engines/kv/kv-store";
import { SqlStore } from "../engines/sql/sql-store";
import { VectorStore } from "../engines/vector/vector-store";
import type { Migration } from "../migrations";
import { getCurrentStorageScope } from "../request-context";
import {
	isCloudStorageScopeRequired,
	parseStorageHost,
	resolveStorageConnectionTargetForScope,
	type StorageConnectionTarget,
	storageConnectionKey,
} from "./connection-target";
import type { Store, StoreSizeInfo } from "./types";
import { StoreType } from "./types";

// Re-export the pure connection-target helpers so existing consumers that import
// them from "back-core" / "./create" keep working. The implementations live in
// ./connection-target so the UI runtime can pull them via the Valkey cache
// WITHOUT statically loading the native transport library. See that file's note.
export {
	isCloudStorageScopeRequired,
	resolveStorageConnectionTargetForScope,
	type StorageConnectionTarget,
};

const DEFAULT_STORAGE_SCOPE = "__default__";

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
	private readonly nativePool = new NativeStorageConnectionPool();
	private readonly defaultConfig?: StorageConnectionTarget;

	constructor(
		defaultConfig?: StorageConnectionTarget,
		private readonly options?: StorageConnectionOptions,
	) {
		this.defaultConfig = defaultConfig;
	}

	private resolveDefaultConfig(): StorageConnectionTarget {
		return this.defaultConfig ?? resolveStorageConnectionTargetForScope();
	}

	addHost(host: string, port?: number): StorageConnection {
		return this.addConnection(parseStorageHost(host, port));
	}

	addConnection(config: StorageConnectionTarget): StorageConnection {
		const key = storageConnectionKey(config);
		const existing = this.entries.get(key);
		if (existing) return existing.conn;

		this.nativePool.add(
			key,
			typeof config === "string" ? { kind: "unix", socketPath: config } : config,
		);
		const conn = new StorageConnection(
			{ kind: "pool", pool: this.nativePool, key, label: key },
			this.options,
		);
		this.entries.set(key, { key, config, conn, refs: 0 });
		this.logPoolState("connection.added", key);
		return conn;
	}

	// The transport connection pool is a key piece of MS runtime state, so its
	// composition is logged as parameters whenever it changes.
	private logPoolState(event: string, key: string): void {
		const entries = this.list();
		const params = entries
			.map((entry) => `${entry.key}(refs=${entry.refs})`)
			.join(" ");
		console.log(
			`[storage-pool] ${event} key=${key} connections=${entries.length}${
				params ? ` | ${params}` : ""
			}`,
		);
	}

	getConnection(host?: string): StorageConnection {
		const config = host ? parseStorageHost(host) : this.resolveDefaultConfig();
		const key = storageConnectionKey(config);
		return this.entries.get(key)?.conn ?? this.addConnection(config);
	}

	getConnectionEntry(host?: string): StoragePoolLease {
		const config = host ? parseStorageHost(host) : this.resolveDefaultConfig();
		const key = storageConnectionKey(config);
		return {
			key,
			conn: this.entries.get(key)?.conn ?? this.addConnection(config),
		};
	}

	getConnectionForScope(scope?: string): StoragePoolLease {
		const config = scope
			? resolveStorageConnectionTargetForScope(scope)
			: this.resolveDefaultConfig();
		const key = storageConnectionKey(config);
		return {
			key,
			conn: this.entries.get(key)?.conn ?? this.addConnection(config),
		};
	}

	acquire(host?: string): StoragePoolLease {
		const config = host ? parseStorageHost(host) : this.resolveDefaultConfig();
		const key = storageConnectionKey(config);
		let entry = this.entries.get(key);
		if (!entry) {
			this.addConnection(config);
			entry = this.entries.get(key);
		}
		if (!entry) throw new Error(`storage pool entry was not created: ${key}`);
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
		this.nativePool.remove(key);
		this.entries.delete(key);
		this.logPoolState("connection.removed", key);
		return true;
	}

	disconnectAll(): void {
		for (const entry of this.entries.values()) {
			entry.conn.close();
		}
		this.nativePool.closeAll();
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

// Print the current transport connection pool state as parameters. Called at
// container startup (the pool is lazy, so it is usually empty until the first
// scoped request — subsequent changes are logged by the pool itself).
export function printStoragePool(
	label: string,
	log: (message: string) => void = console.log,
): void {
	const entries = storageConnectionPool.list();
	log(
		`[storage-pool] ${label}: transport=${settings.storage.transport()} ` +
			`hostSource=${settings.storage.servicePrefix() ? `prefix:${settings.storage.servicePrefix()}` : `host:${settings.storage.host() ?? "-"}`} ` +
			`storagePort=${settings.storage.port()} valkeyPort=${settings.cache.valkeyPort()} ` +
			`valkeyDb=${settings.cache.valkeyDatabase()} connections=${entries.length}`,
	);
	for (const entry of entries) {
		log(`[storage-pool]   ${entry.key} refs=${entry.refs}`);
	}
}

// This module is only loaded in containers that actually talk to storage (MS/RT
// service plugins), never in the UI bundle. Printing the initial pool state here
// gives every storage-bearing container a startup line without the UI runtime
// having to import (and thus bundle) the native transport.
try {
	printStoragePool("startup");
} catch {
	// Storage settings not configured (tests/tooling importing this module). The
	// real MS/RT container validates settings at startup before loading plugins.
}

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
	private readonly storeTypes: Record<string, TransportStoreTypeKey> = {};
	private readonly initializedScopes = new Set<string>();
	private readonly scopeInitPromises = new Map<string, Promise<void>>();
	private readonly fixedStorageHost?: string;

	constructor(
		protected msName: string,
		storageHost?: string,
	) {
		this.fixedStorageHost = storageHost;
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

	private shouldDeferStorageInit(): boolean {
		return (
			!this.fixedStorageHost &&
			!getCurrentStorageScope() &&
			isCloudStorageScopeRequired()
		);
	}

	async startAll() {
		if (this.shouldDeferStorageInit()) {
			logStoreDebug("open:defer", { msName: this.msName });
			return;
		}

		for (const [name, store] of Object.entries(this.stores)) {
			const startedAt = Date.now();
			logStoreDebug("open:start", { msName: this.msName, store: name });
			try {
				const storeType = this.storeTypes[name];
				if (storeType) {
					this.conn.create(this.msName, name, storeType);
				}
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
		if (this.shouldDeferStorageInit()) {
			logStoreDebug("migrate:defer", { msName: this.msName });
			return;
		}

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
		this.storeTypes[name] = declaredTransportType;
		const scope = getCurrentStorageScope();
		let actualType = type;

		if (this.fixedStorageHost || scope) {
			// create is idempotent on the server side: opens existing or creates new
			this.conn.create(this.msName, name, declaredTransportType);
			const manifest = this.conn.getManifest(this.msName, name);
			actualType = fromTransportStoreType(manifest.storeType, type);
		}

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
