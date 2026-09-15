import { JsonStore, BaseRepositoryJson, BaseKeyJson } from "back-core";
import type { NotifyProfile, NotifyProfilePatch } from "../../types";

class ProfileKey extends BaseKeyJson {
	readonly type = "profile";
}

class NotifyProfileRepository extends BaseRepositoryJson<
	ProfileKey,
	NotifyProfile
> {}

const ROW_ID = "default";

/**
 * Never absent, like the review settings: a letter sent before anybody opened
 * the profile still has a language and a name to put above the card.
 */
export const DEFAULT_PROFILE: NotifyProfile = {
	lang: "en",
	brand: "Converge",
};

function clean(value: string | undefined): string | undefined {
	const trimmed = (value ?? "").trim();
	return trimmed || undefined;
}

export class NotifyProfileStoreService {
	private readonly repo: NotifyProfileRepository;

	constructor(store: JsonStore) {
		this.repo = new NotifyProfileRepository(store);
	}

	async get(): Promise<NotifyProfile> {
		const stored = await this.repo.get(new ProfileKey(ROW_ID));
		return { ...DEFAULT_PROFILE, ...(stored ?? {}) };
	}

	async save(patch: NotifyProfilePatch): Promise<NotifyProfile> {
		const current = await this.get();
		const next: NotifyProfile = {
			...current,
			updatedAt: new Date().toISOString(),
		};
		if (patch.lang !== undefined) {
			// Stored as the base tag a template is keyed by: "pt-BR" → "pt".
			next.lang =
				clean(patch.lang)?.toLowerCase().split(/[-_]/)[0] ??
				DEFAULT_PROFILE.lang;
		}
		if (patch.brand !== undefined)
			next.brand = clean(patch.brand) ?? DEFAULT_PROFILE.brand;
		if (patch.supportEmail !== undefined)
			next.supportEmail = clean(patch.supportEmail);
		if (patch.address !== undefined) next.address = clean(patch.address);
		await this.repo.save(new ProfileKey(ROW_ID), next);
		return next;
	}
}
