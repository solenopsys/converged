import { JsonStore, StoreControllerAbstract, StoreType } from "back-core";
import { AudioGateConfigStoreService } from "./configs/service";

export class StoresController extends StoreControllerAbstract {
	public ipTelephonyConfigs!: AudioGateConfigStoreService;
	public llmAudioGateConfigs!: AudioGateConfigStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const ipTelephonyStore = await this.addStore(
			"ip-telephony-configs",
			StoreType.JSON,
			[],
		);
		const llmAudioGateStore = await this.addStore(
			"llm-gate-configs",
			StoreType.JSON,
			[],
		);

		this.ipTelephonyConfigs = new AudioGateConfigStoreService(
			ipTelephonyStore as JsonStore,
			"ip-telephony",
		);
		this.llmAudioGateConfigs = new AudioGateConfigStoreService(
			llmAudioGateStore as JsonStore,
			"llm-audio-gate",
		);

		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
