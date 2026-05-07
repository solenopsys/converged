import {
	BaseKeyJson,
	BaseRepositoryJson,
	type JsonStore,
} from "back-core";
import type {
	RequestProcessType,
	RequestRequirementProfile,
	RequestRequirementsCatalog,
} from "../../types";

class RequirementProfileKey extends BaseKeyJson {
	readonly type = "profile";
}

class RequirementProfileRepository extends BaseRepositoryJson<
	RequirementProfileKey,
	RequestRequirementProfile
> {}

export class RequestRequirementsStoreService {
	private readonly repo: RequirementProfileRepository;
	private readonly cache = new Map<RequestProcessType, RequestRequirementProfile>();

	constructor(private readonly store: JsonStore) {
		this.repo = new RequirementProfileRepository(store);
	}

	async seedBundledDefaults(): Promise<void> {
		const catalog = await loadBundledDefaultRequirements();
		await this.seedDefaults(catalog);
	}

	async seedDefaults(catalog: RequestRequirementsCatalog): Promise<void> {
		for (const profile of catalog.profiles ?? []) {
			if (!profile.processType) continue;
			const key = new RequirementProfileKey(profile.processType);
			if (!this.repo.exists(key)) {
				await this.repo.save(key, profile);
			}
		}
		await this.refreshCache();
	}

	async refreshCache(): Promise<void> {
		const profiles = await this.listProfiles();
		this.cache.clear();
		for (const profile of profiles) {
			this.cache.set(profile.processType, profile);
		}
	}

	async saveProfile(profile: RequestRequirementProfile): Promise<void> {
		await this.repo.save(new RequirementProfileKey(profile.processType), profile);
		this.cache.set(profile.processType, profile);
	}

	async getProfile(
		processType: RequestProcessType,
	): Promise<RequestRequirementProfile | undefined> {
		const cached = this.cache.get(processType);
		if (cached) return cached;
		const profile = await this.repo.get(new RequirementProfileKey(processType));
		if (profile) {
			this.cache.set(processType, profile);
		}
		return profile;
	}

	getProfileSync(
		processType: RequestProcessType,
	): RequestRequirementProfile | undefined {
		return this.cache.get(processType);
	}

	async listProfiles(): Promise<RequestRequirementProfile[]> {
		return this.repo.listAll();
	}

	async getCatalog(): Promise<RequestRequirementsCatalog> {
		const profiles = await this.listProfiles();
		return {
			version: "store",
			defaultProcessType: "generic",
			profiles,
		};
	}
}

export type RequestRequirementsProvider = Pick<
	RequestRequirementsStoreService,
	"getProfile" | "getProfileSync" | "listProfiles"
>;

export async function loadBundledDefaultRequirements(): Promise<RequestRequirementsCatalog> {
	const file = Bun.file(new URL("./defaults.json", import.meta.url));
	return (await file.json()) as RequestRequirementsCatalog;
}
