import { type Counter, createCountersServiceClient } from "g-counters";
import { createSsrNrpcClientConfig } from "./nrpc";

// Per-tenant analytics counters resolved by scope. GA/GTM/pixel ids change ~never,
// so the result is cached in-process per scope to avoid an RPC on every SSR render.
// First request for a tenant pays one call to ms-counters; the rest are Map hits.

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { counters: Counter[]; exp: number }>();

function hasMicroservice(name: string): boolean {
	const raw = process.env.MICROSERVICES?.trim();
	if (!raw) return false;

	try {
		const microservices = JSON.parse(raw);
		return Array.isArray(microservices) && microservices.includes(name);
	} catch {
		throw new Error("MICROSERVICES must be a JSON array");
	}
}

// Single GA id wired through the deployment env (club sets it in confs/*.env and
// the ui secret). Merged with ms-counters so an env-only tenant still gets GA.
function envCounter(): Counter[] {
	const gaId = process.env.ANALYTICS_ID?.trim();
	if (!gaId) return [];
	return [
		{
			id: "google-analytics",
			type: "google-analytics",
			trackingId: gaId,
			enabled: true,
		},
	];
}

export async function resolveCounters(workspace?: string): Promise<Counter[]> {
	const key = workspace ?? "__default__";
	const hit = cache.get(key);
	if (hit && hit.exp > Date.now()) return hit.counters;

	const fallback = envCounter();
	if (!hasMicroservice("counters")) return fallback;

	let counters: Counter[];
	try {
		const client = createCountersServiceClient(
			createSsrNrpcClientConfig({ scope: workspace }),
		);
		const remote = (await client.listEnabled()) ?? [];
		// ms-counters wins on id collision; env GA only fills the gap.
		const ids = new Set(remote.map((counter) => counter.id));
		counters = [
			...remote,
			...fallback.filter((counter) => !ids.has(counter.id)),
		];
	} catch (error) {
		console.error("[ssr] counters fetch failed", error);
		// Serve stale rather than dropping analytics entirely mid-flight.
		if (hit) return hit.counters;
		counters = fallback;
	}

	cache.set(key, { counters, exp: Date.now() + TTL_MS });
	return counters;
}
