import type { SqlStore } from "back-core";
import type { ReviewSettings, ReviewSettingsPatch } from "../types";

const ROW_ID = "default";

/**
 * The shop's funnel settings, with the safe answer as the default.
 *
 * `positiveThreshold` changes the *emphasis* of the public form and nothing
 * more: at or above it the author is offered the platforms first, below it a
 * word with the shop comes first. The platform links themselves stay visible
 * either way — Google and several other platforms forbid showing the path to a
 * public review only to satisfied customers, and a product that ships the
 * forbidden behaviour by default is a complaint waiting to happen. Anyone who
 * wants gating has to build it; they will not get it by leaving this alone.
 */
export const DEFAULT_SETTINGS: ReviewSettings = {
	platforms: [],
	positiveThreshold: 4,
	requestDelayHours: 24,
	followupDelayDays: 5,
	maxFollowups: 1,
	inviteTtlDays: 30,
	publicFormUrl: "",
};

export class ReviewSettingsStoreService {
	constructor(private store: SqlStore) {}

	/**
	 * Never absent: a shop that has never opened the settings screen still runs
	 * the funnel, and it runs it on the defaults above.
	 */
	async get(): Promise<ReviewSettings> {
		const row = (await this.store.db
			.selectFrom("review_settings" as never)
			.selectAll()
			.where("id" as never, "=", ROW_ID)
			.executeTakeFirst()) as { value: string; updatedAt: string } | undefined;
		if (!row) return { ...DEFAULT_SETTINGS };
		try {
			return {
				...DEFAULT_SETTINGS,
				...(JSON.parse(row.value) as ReviewSettings),
				updatedAt: row.updatedAt,
			};
		} catch {
			// A row that no longer parses is a row from an older shape or a bad
			// write; the funnel keeps running on defaults rather than stopping.
			return { ...DEFAULT_SETTINGS, updatedAt: row.updatedAt };
		}
	}

	async save(patch: ReviewSettingsPatch): Promise<ReviewSettings> {
		const current = await this.get();
		const next: ReviewSettings = { ...current, ...patch };
		delete next.updatedAt;
		const updatedAt = new Date().toISOString();
		await this.store.db
			.insertInto("review_settings" as never)
			.values({ id: ROW_ID, value: JSON.stringify(next), updatedAt } as never)
			.onConflict((oc: any) =>
				oc.column("id").doUpdateSet({
					value: JSON.stringify(next),
					updatedAt,
				}),
			)
			.execute();
		return { ...next, updatedAt };
	}
}
