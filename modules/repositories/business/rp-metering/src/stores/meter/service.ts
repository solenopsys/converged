import { generateULID, SqlStore, sql } from "back-core";
import type {
	MeterDailyItem,
	MeterDailyParams,
	MeterResource,
	MeterSampleInput,
} from "../../types";

export class MeterStoreService {
	constructor(private store: SqlStore) {}

	/** The owner is already settled by the service; here it is always present. */
	async record(samples: (MeterSampleInput & { owner: string })[]): Promise<number> {
		if (!samples?.length) {
			return 0;
		}

		const now = new Date().toISOString();
		const rows = samples.map((sample) => ({
			id: generateULID(),
			owner: sample.owner,
			resource: sample.resource,
			amount: sample.amount,
			at: sample.at ?? now,
		}));

		await this.store.db.insertInto("meter_samples").values(rows).execute();
		return rows.length;
	}

	async dailyTotals(params: MeterDailyParams = {}): Promise<MeterDailyItem[]> {
		// `at` is an ISO string, so the day is its first ten characters and a
		// range on it is a plain string comparison — no date parsing anywhere.
		const dayExpr = sql<string>`substr(at, 1, 10)`;
		let query = this.store.db
			.selectFrom("meter_samples")
			.select(({ fn }) => [
				dayExpr.as("date"),
				"owner",
				"resource",
				fn.sum<number>("amount").as("amount"),
			])
			.groupBy([dayExpr, "owner", "resource"])
			.orderBy(dayExpr, "asc");

		if (params.owner) query = query.where("owner", "=", params.owner);
		if (params.from) query = query.where("at", ">=", params.from);
		if (params.to) query = query.where("at", "<=", params.to);

		const rows = await query.execute();
		return rows.map((row: any) => ({
			date: row.date,
			owner: row.owner,
			resource: row.resource as MeterResource,
			amount: Number(row.amount ?? 0),
		}));
	}

	/**
	 * Wins the right to charge for one day, or loses it to whoever already has.
	 *
	 * The insert is the decision — `doNothing` on the key means a second caller
	 * inserts no row and is told so, rather than both callers reading "not yet
	 * billed" and both going on to bill.
	 */
	async claimDay(date: string, owner: string, resource: MeterResource): Promise<boolean> {
		const result = await this.store.db
			.insertInto("meter_billed")
			.values({ date, owner, resource, claimedAt: new Date().toISOString() })
			.onConflict((oc) => oc.columns(["date", "owner", "resource"]).doNothing())
			.executeTakeFirst();
		return Number(result?.numInsertedOrUpdatedRows ?? 0) > 0;
	}
}
