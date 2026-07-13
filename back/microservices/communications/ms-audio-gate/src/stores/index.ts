import { JsonStore, StoreControllerAbstract, StoreType } from "back-core";
import { PhoneNumberStoreService } from "./phone-numbers/service";
import { LlmGateConfigStoreService } from "./llm-gate/service";

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
		// Created here so the centimanus container can read/write it
		// (LLM_GATE_TRANSPORT_STORE=llm-gate-configs). The gate never creates it.
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
