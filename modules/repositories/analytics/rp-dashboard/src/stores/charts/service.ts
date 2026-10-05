import type { KVStore } from "back-core";
import type { DashboardChartCache } from "../../types";

const PREFIX = "chart-cache";

/** Stores last-known JSON payloads for dashboard charts. */
export class DashboardChartCacheStoreService {
	constructor(private readonly store: KVStore) {}

	get(key: string): DashboardChartCache | null {
		const normalized = this.normalizeKey(key);
		const value = this.store.get([PREFIX, normalized]) as DashboardChartCache | undefined;
		return value ?? null;
	}

	set(key: string, data: unknown): void {
		const normalized = this.normalizeKey(key);
		this.store.put([PREFIX, normalized], {
			key: normalized,
			data,
			updatedAt: new Date().toISOString(),
		});
	}

	private normalizeKey(key: string): string {
		const normalized = key.trim();
		if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(normalized)) {
			const error = new Error("Chart cache key must be modulename.graphicname") as Error & {
				statusCode?: number;
			};
			error.statusCode = 400;
			throw error;
		}
		return normalized;
	}
}
