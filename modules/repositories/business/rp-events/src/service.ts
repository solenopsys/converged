import { createServerNrpcClientConfig } from "back-core";
import { createBusServiceClient } from "g-bus";
import { StoresController } from "./stores";
import type {
	BusinessEvent,
	BusinessEventInput,
	EventId,
	EventsService,
} from "./types";

const REPOSITORY_ID = "rp-events";

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
			this.stores = new StoresController(REPOSITORY_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	async publish(input: BusinessEventInput): Promise<EventId> {
		await this.init();
		const id = await this.stores.events.publish(input);
		try {
			await createBusServiceClient(createServerNrpcClientConfig()).publish({
				name: `${input.type}.${input.entityId}`,
				source: "service",
				dedupKey: `business-event:${id}`,
				payload: {
					eventId: id,
					type: input.type,
					service: input.service,
					entityId: input.entityId,
					parentId: input.parentId,
					label: input.label,
				},
			});
		} catch (error) {
			// The durable journal is authoritative; a live bus outage must not
			// make its successful write look like a failed business operation.
			console.warn(
				"[rp-events] live event publish failed",
				input.type,
				id,
				error,
			);
		}
		return id;
	}

	async listEvents(offset: number, limit: number): Promise<BusinessEvent[]> {
		await this.init();
		return this.stores.events.listEvents(offset, limit);
	}

	async destroy(): Promise<void> {
		await this.stores?.destroy();
	}
}
