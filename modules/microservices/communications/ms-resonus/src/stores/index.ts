import { type JsonStore, StoreControllerAbstract, StoreType } from "back-core";
import { LlmGateConfigStoreService } from "./llm-gate/service";
import { PhoneNumberStoreService } from "./phone-numbers/service";

export class StoresController extends StoreControllerAbstract {
	public phoneNumbers!: PhoneNumberStoreService;
	public llmGateConfigs!: LlmGateConfigStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const phoneNumbersStore = await this.addStore(
			"phone-numbers",
			StoreType.JSON,
			[],
		);
		// Owned here; the stateless Resonus process accesses it only through NRPC.
		const llmGateStore = await this.addStore(
			"llm-gate-configs",
			StoreType.JSON,
			[],
		);

		this.phoneNumbers = new PhoneNumberStoreService(
			phoneNumbersStore as JsonStore,
		);
		this.llmGateConfigs = new LlmGateConfigStoreService(
			llmGateStore as JsonStore,
		);

		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
