import type { Counter } from "g-counters";
import { createCountersServiceClient } from "g-counters";

// Per-tenant analytics counters resolved by scope. GA/GTM/pixel ids change ~never,
// so we cache the result in-process per scope to avoid an RPC on every SSR render.
// First request for a tenant pays one call to ms-counters; the rest are Map hits.

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { counters: Counter[]; exp: number }>();

export async function resolveCounters(
	servicesBaseUrl: string,
	workspace?: string,
): Promise<Counter[]> {
	const key = workspace ?? "__default__";
	const hit = cache.get(key);
	if (hit && hit.exp > Date.now()) return hit.counters;

	let counters: Counter[] = [];
	try {
		const client = createCountersServiceClient({
			baseUrl: servicesBaseUrl,
			workspace,
		});
		counters = (await client.listEnabled()) ?? [];
	} catch (error) {
		console.error("[landing] counters fetch failed", error);
		// Serve stale on failure rather than dropping analytics entirely.
		if (hit) return hit.counters;
	}

	cache.set(key, { counters, exp: Date.now() + TTL_MS });
	return counters;
}
