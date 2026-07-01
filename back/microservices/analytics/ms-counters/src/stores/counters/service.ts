import type { FileStore } from "back-core";
import type { Counter, CounterInput } from "../../types";

// All counters for a scope live in a single small JSON document. The FileStore
// itself is scope-partitioned, so this key is per tenant.
const DOC_KEY = "counters.json";

export class CountersStoreService {
	constructor(private store: FileStore) {}

	async list(): Promise<Counter[]> {
		const data = await this.store.get(DOC_KEY);
		if (!data) return [];
		try {
			const parsed = JSON.parse(new TextDecoder().decode(data));
			return Array.isArray(parsed) ? (parsed as Counter[]) : [];
		} catch {
			return [];
		}
	}

	async get(id: string): Promise<Counter | null> {
		const all = await this.list();
		return all.find((c) => c.id === id) ?? null;
	}

	async upsert(input: CounterInput): Promise<Counter> {
		const all = await this.list();
		const now = new Date().toISOString();
		const idx = all.findIndex((c) => c.id === input.id);

		if (idx >= 0) {
			const next: Counter = {
				...all[idx],
				type: input.type,
				trackingId: input.trackingId,
				headSnippet: input.headSnippet,
				enabled: input.enabled ?? all[idx].enabled,
				updatedAt: now,
			};
			all[idx] = next;
			await this.save(all);
			return next;
		}

		const created: Counter = {
			id: input.id,
			type: input.type,
			trackingId: input.trackingId,
			headSnippet: input.headSnippet,
			enabled: input.enabled ?? true,
			createdAt: now,
			updatedAt: now,
		};
		all.push(created);
		await this.save(all);
		return created;
	}

	async delete(id: string): Promise<void> {
		const all = await this.list();
		const next = all.filter((c) => c.id !== id);
		if (next.length !== all.length) await this.save(next);
	}

	private async save(counters: Counter[]): Promise<void> {
		const bytes = new TextEncoder().encode(JSON.stringify(counters));
		await this.store.put(DOC_KEY, bytes);
	}
}
