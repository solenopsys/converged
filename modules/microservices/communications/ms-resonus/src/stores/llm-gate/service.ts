import { BaseKeyJson, BaseRepositoryJson, type JsonStore } from "back-core";
import type {
	LlmGateConfig,
	LlmGateConfigId,
	LlmGateConfigInput,
} from "g-resonus";

class LlmGateConfigKey extends BaseKeyJson {
	readonly type = "llm-gate-config";
}

class LlmGateConfigRepository extends BaseRepositoryJson<
	LlmGateConfigKey,
	LlmGateConfig
> {}

export class LlmGateConfigStoreService {
	private readonly repo: LlmGateConfigRepository;

	constructor(store: JsonStore) {
		this.repo = new LlmGateConfigRepository(store);
	}

	async save(input: LlmGateConfigInput): Promise<LlmGateConfigId> {
		await this.repo.save(new LlmGateConfigKey(input.id), {
			id: input.id,
			config: input.config,
		});
		return input.id;
	}

	async get(id: LlmGateConfigId): Promise<LlmGateConfig | undefined> {
		return this.repo.get(new LlmGateConfigKey(id));
	}

	async list(): Promise<LlmGateConfig[]> {
		return this.repo.listAll();
	}

	async delete(id: LlmGateConfigId): Promise<boolean> {
		return this.repo.delete(new LlmGateConfigKey(id));
	}
}
