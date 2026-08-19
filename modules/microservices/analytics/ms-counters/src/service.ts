import { badRequestError } from "back-core";
import { Access } from "nrpc";
import { StoresController } from "./stores";
import type { Counter, CounterInput, CountersService } from "./types";

const MS_ID = "counters-ms";

export class CountersServiceImpl implements CountersService {
	private stores!: StoresController;
	private initPromise: Promise<void>;

	constructor() {
		this.initPromise = this.init();
	}

	async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(MS_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	@Access("public")
	async listCounters(): Promise<Counter[]> {
		await this.ensureReady();
		return this.stores.counters.list();
	}

	@Access("public")
	async listEnabled(): Promise<Counter[]> {
		await this.ensureReady();
		const all = await this.stores.counters.list();
		return all.filter((c) => c.enabled);
	}

	@Access("public")
	async getCounter(id: string): Promise<Counter | null> {
		await this.ensureReady();
		return this.stores.counters.get(id);
	}

	async upsertCounter(input: CounterInput): Promise<Counter> {
		await this.ensureReady();
		if (!input?.id?.trim()) {
			throw badRequestError("counter id is required");
		}
		if (!input?.type) {
			throw badRequestError("counter type is required");
		}
		if (input.type === "custom") {
			if (!input.headSnippet?.trim()) {
				throw badRequestError('headSnippet is required for type "custom"');
			}
		} else if (!input.trackingId?.trim()) {
			throw badRequestError(`trackingId is required for type "${input.type}"`);
		}
		return this.stores.counters.upsert(input);
	}

	async deleteCounter(id: string): Promise<void> {
		await this.ensureReady();
		if (!id?.trim()) {
			throw badRequestError("counter id is required");
		}
		await this.stores.counters.delete(id);
	}

	private async ensureReady(): Promise<void> {
		await this.initPromise;
	}
}

export default CountersServiceImpl;
