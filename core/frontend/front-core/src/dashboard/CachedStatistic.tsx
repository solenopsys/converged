import { createDashboardServiceClient } from "g-dashboard";
import { createElement, type ComponentType } from "preact/compat";
import { useCallback, useEffect, useState } from "preact/hooks";
import { createFrontNrpcClientConfig } from "signal-channel";

const client = createDashboardServiceClient(createFrontNrpcClientConfig());
const BROWSER_CACHE_DB = "front-core-dashboard-cache";
const BROWSER_CACHE_STORE = "charts";

type BrowserChartCache = { key: string; data: unknown; updatedAt: string };

function browserCacheRequest<T>(
	mode: IDBTransactionMode,
	operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
	if (typeof indexedDB === "undefined") return Promise.resolve(undefined);
	return new Promise((resolve) => {
		let settled = false;
		const finish = (value: T | undefined) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};
		try {
			const opening = indexedDB.open(BROWSER_CACHE_DB, 1);
			opening.onupgradeneeded = () => {
				const database = opening.result;
				if (!database.objectStoreNames.contains(BROWSER_CACHE_STORE)) {
					database.createObjectStore(BROWSER_CACHE_STORE, { keyPath: "key" });
				}
			};
			opening.onerror = () => finish(undefined);
			opening.onsuccess = () => {
				const database = opening.result;
				try {
					const request = operation(database.transaction(BROWSER_CACHE_STORE, mode).objectStore(BROWSER_CACHE_STORE));
					request.onsuccess = () => finish(request.result);
					request.onerror = () => finish(undefined);
				} catch {
					finish(undefined);
				} finally {
					database.close();
				}
			};
		} catch {
			finish(undefined);
		}
	});
}

function readBrowserCache(key: string): Promise<BrowserChartCache | undefined> {
	return browserCacheRequest("readonly", (store) => store.get(key));
}

function writeBrowserCache(entry: BrowserChartCache): Promise<unknown> {
	return browserCacheRequest("readwrite", (store) => store.put(entry));
}

/** Mounts a statistic with its last successful payload, then accepts live updates. */
export function CachedStatistic({
	component: Component,
	cacheKey,
	props,
}: {
	component: ComponentType<any>;
	cacheKey: string;
	props: Record<string, unknown>;
}) {
	const [cachedData, setCachedData] = useState<unknown>();
	const [cacheLoaded, setCacheLoaded] = useState(false);
	useEffect(() => {
		let active = true;
		setCachedData(undefined);
		setCacheLoaded(false);
		void (async () => {
			const browserEntry = await readBrowserCache(cacheKey).catch(() => undefined);
			if (!active) return;
			if (browserEntry) {
				setCachedData(browserEntry.data);
				setCacheLoaded(true);
				return;
			}
			try {
				const serverEntry = await client.getChartCache(cacheKey);
				if (!active) return;
				if (serverEntry) {
					setCachedData(serverEntry.data);
					void writeBrowserCache(serverEntry).catch(() => undefined);
				}
			} catch {
				// A cache outage should not keep the live statistic from mounting.
			} finally {
				if (active) setCacheLoaded(true);
			}
		})();
		return () => { active = false; };
	}, [cacheKey]);
	const onCacheData = useCallback((data: unknown) => {
		setCachedData(data);
		const entry = { key: cacheKey, data, updatedAt: new Date().toISOString() };
		void writeBrowserCache(entry).catch(() => undefined);
		void client.setChartCache(cacheKey, data).catch(() => {});
	}, [cacheKey]);
	if (!cacheLoaded) return null;
	return createElement(Component, { ...props, cachedData, onCacheData });
}
