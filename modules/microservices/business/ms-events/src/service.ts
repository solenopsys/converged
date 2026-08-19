import { StoresController } from "./stores";
import type {
	BusinessEvent,
	BusinessEventInput,
	EventId,
	EventsService,
} from "./types";

const MS_ID = "events-ms";

export class EventsServiceImpl implements EventsService {
	private stores!: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	async init(): Promise<void> {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(MS_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	async publish(input: BusinessEventInput): Promise<EventId> {
		await this.init();
		return this.stores.events.publish(input);
	}

	async listEvents(offset: number, limit: number): Promise<BusinessEvent[]> {
		await this.init();
		return this.stores.events.listEvents(offset, limit);
	}

	async destroy(): Promise<void> {
		await this.stores?.destroy();
	}
}
