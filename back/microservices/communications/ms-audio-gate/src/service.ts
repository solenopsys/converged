import { Access } from "nrpc";
import type {
	AudioGateService,
	LlmGateConfig,
	LlmGateConfigId,
	LlmGateConfigInput,
	PaginatedResult,
	PhoneNumber,
	PhoneNumberId,
	PhoneNumberInput,
	PhoneNumberListParams,
	PhoneNumberUpdate,
} from "g-audio-gate";
import { StoresController } from "./stores";

const MS_ID = "audio-gate-ms";

export class AudioGateServiceImpl implements AudioGateService {
	stores!: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	async init(): Promise<void> {
		if (this.initPromise) return this.initPromise;
		this.initPromise = (async () => {
			this.stores = new StoresController(MS_ID);
			await this.stores.init();
			await this.seedPlaceholder();
		})();
		return this.initPromise;
	}

	// Placeholder so the public landing shows a number out of the box; real
	// numbers are managed through AudioGateService. Only seeds an empty store.
	private async seedPlaceholder(): Promise<void> {
		try {
			const existing = await this.stores.phoneNumbers.list({ limit: 1 });
			if ((existing.totalCount ?? existing.items.length) > 0) return;
			await this.stores.phoneNumbers.save({
				kind: "external",
				phone: "+1 (702) 555-0142",
				label: "Sales",
				enabled: true,
				primary: true,
			});
		} catch (error) {
			console.warn("[ms-audio-gate] placeholder seed skipped:", error);
		}
	}

	private async ready(): Promise<void> {
		await this.init();
	}

	// ── Phone numbers ────────────────────────────────────────────────────

	async savePhoneNumber(input: PhoneNumberInput): Promise<PhoneNumberId> {
		await this.ready();
		return this.stores.phoneNumbers.save(input);
	}

	async updatePhoneNumber(
		id: PhoneNumberId,
		patch: PhoneNumberUpdate,
	): Promise<void> {
		await this.ready();
		return this.stores.phoneNumbers.update(id, patch);
	}

	async getPhoneNumber(id: PhoneNumberId): Promise<PhoneNumber | undefined> {
		await this.ready();
		return this.stores.phoneNumbers.get(id);
	}

	async deletePhoneNumber(id: PhoneNumberId): Promise<boolean> {
		await this.ready();
		return this.stores.phoneNumbers.delete(id);
	}

	async listPhoneNumbers(
		params: PhoneNumberListParams,
	): Promise<PaginatedResult<PhoneNumber>> {
		await this.ready();
		return this.stores.phoneNumbers.list(params ?? {});
	}

	// Public: the landing header reads this unauthenticated at SSR.
	@Access("public")
	async getPrimaryPhoneNumber(): Promise<PhoneNumber | undefined> {
		await this.ready();
		return this.stores.phoneNumbers.getPrimary();
	}

	// ── LLM gate configs ─────────────────────────────────────────────────

	async saveLlmGateConfig(input: LlmGateConfigInput): Promise<LlmGateConfigId> {
		await this.ready();
		return this.stores.llmGateConfigs.save(input);
	}

	async getLlmGateConfig(
		id: LlmGateConfigId,
	): Promise<LlmGateConfig | undefined> {
		await this.ready();
		return this.stores.llmGateConfigs.get(id);
	}

	async listLlmGateConfigs(): Promise<LlmGateConfig[]> {
		await this.ready();
		return this.stores.llmGateConfigs.list();
	}

	async deleteLlmGateConfig(id: LlmGateConfigId): Promise<boolean> {
		await this.ready();
		return this.stores.llmGateConfigs.delete(id);
	}
}

export default AudioGateServiceImpl;
