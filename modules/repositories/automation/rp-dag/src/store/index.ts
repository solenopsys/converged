import {
	type JsonStore,
	type KVStore,
	StoreControllerAbstract,
	StoreType,
} from "back-core";
import { ProcessingStoreService } from "./processing";
import { TriggersStoreService } from "./triggers";

/**
 * Two stores, because there are two kinds of thing here.
 *
 * `processing` is the execution log — high volume, written by the runtime as a
 * script runs, read back as a tree. `triggers` is configuration — tens of rows
 * an operator maintains by hand.
 */
export class StoresController extends StoreControllerAbstract {
	public processingStoreService!: ProcessingStoreService;
	public triggersStoreService!: TriggersStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const processingStore = await this.addStore(
			"processing",
			StoreType.KVS,
			[],
		);
		this.processingStoreService = new ProcessingStoreService(
			processingStore as KVStore,
		);

		const triggersStore = await this.addStore("triggers", StoreType.JSON, []);
		this.triggersStoreService = new TriggersStoreService(
			triggersStore as JsonStore,
		);

		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
