import { BaseKeyJson, BaseRepositoryJson, JsonStore } from "back-core";

export type AudioGateConfigValue = Record<string, unknown>;

class ConfigKey extends BaseKeyJson {
	readonly type: string;

	constructor(type: string, key: string) {
		super(key);
		this.type = type;
	}
}

class ConfigRepository extends BaseRepositoryJson<ConfigKey, AudioGateConfigValue> {}

export class AudioGateConfigStoreService {
	private readonly repo: ConfigRepository;

	constructor(
		store: JsonStore,
		private readonly type: "ip-telephony" | "llm-audio-gate",
	) {
		this.repo = new ConfigRepository(store);
	}

	async save(id: string, value: AudioGateConfigValue): Promise<void> {
		await this.repo.save(new ConfigKey(this.type, id), value);
	}

	async get(id: string): Promise<AudioGateConfigValue | undefined> {
		return this.repo.get(new ConfigKey(this.type, id));
	}

	async list(): Promise<AudioGateConfigValue[]> {
		return this.repo.listAll();
	}

	async delete(id: string): Promise<boolean> {
		return this.repo.delete(new ConfigKey(this.type, id));
	}
}
