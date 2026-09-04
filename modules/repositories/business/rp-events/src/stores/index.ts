import { type SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import eventsMigrations from "./events/migrations";
import { EventsStoreService } from "./events/service";

export class StoresController extends StoreControllerAbstract {
	public events!: EventsStoreService;

	async init(): Promise<void> {
		const eventsStore = await this.addStore(
			"events",
			StoreType.SQL,
			eventsMigrations,
		);
		this.events = new EventsStoreService(eventsStore as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy(): Promise<void> {
		await this.closeAll();
	}
}
