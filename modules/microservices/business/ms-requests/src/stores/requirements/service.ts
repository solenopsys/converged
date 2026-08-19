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

