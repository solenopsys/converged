import type {
	LlmGateConfig,
	LlmGateConfigId,
	LlmGateConfigInput,
	PaginatedResult,
	PhoneNumber,
	PhoneNumberId,
	PhoneNumberInput,
	PhoneNumberListParams,
	PhoneNumberUpdate,
	ResonusService,
} from "g-resonus";
import { Access } from "nrpc";
import { StoresController } from "./stores";

const MS_ID = "resonus-ms";

export class ResonusServiceImpl implements ResonusService {
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
			// NB: do NOT touch the store here. In cloud mode the store is tenant-
			// scoped and the scope is only resolvable from request headers — at
			// startup there is no request, so any read throws "Storage scope is
			// required". Seeding happens lazily per-tenant inside request handlers.
		})();
		return this.initPromise;
	}

	// Placeholder so the public landing shows a number out of the box; real
	// numbers are managed through ResonusService. Must run inside a request
	// scope (cloud storage is per-tenant). The empty-store check is itself the
	// per-scope guard: once a tenant is seeded, list() is non-empty and we skip.
	private async ensureSeeded(): Promise<void> {
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
			console.warn("[ms-resonus] placeholder seed skipped:", error);
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
		await this.ensureSeeded();
		return this.stores.phoneNumbers.list(params ?? {});
	}

	// Public: the landing header reads this unauthenticated at SSR.
	@Access("public")
	async getPrimaryPhoneNumber(): Promise<PhoneNumber | undefined> {
		await this.ready();
		await this.ensureSeeded();
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

export default ResonusServiceImpl;
