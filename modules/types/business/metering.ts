export type ISODateString = string;

/**
 * What is measured. Three units, because that is what a deployment actually
 * spends: model tokens, stored or moved bytes, and processor time.
 *
 * Calls are deliberately absent — those are `rp-usage`, which answers "is this
 * solution used" and is counted per function. Mixing the two gives a number
 * that is neither activity nor cost.
 */
export type MeterResource = "tokens" | "bytes" | "ms";

/**
 * `owner` is the account the consumption belongs to. It is a claim from a
 * person and a fact from a service, exactly as in `rp-billing`: a meter anybody
 * can write against somebody else's account is a meter that bills the wrong
 * company.
 */
export type MeterSampleInput = {
	owner?: string;
	resource: MeterResource;
	amount: number;
	at?: ISODateString;
};

export type MeterDailyItem = {
	date: string;
	owner: string;
	resource: MeterResource;
	amount: number;
};

export type MeterDailyParams = {
	owner?: string;
	from?: ISODateString;
	to?: ISODateString;
};

export interface MeteringService {
	record(samples: MeterSampleInput[]): Promise<{ inserted: number }>;

	/** Consumption per owner, per resource, per day — what a charge is made of. */
	dailyTotals(params?: MeterDailyParams): Promise<MeterDailyItem[]>;

	/**
	 * Takes one day's consumption for billing, once.
	 *
	 * Returns `false` if that day was already taken. The daily charge job is the
	 * one thing here that spends money, and it will be re-run — after a crash, a
	 * retry, or a human wondering whether it worked. Without a claim it charges
	 * twice, and the second charge is indistinguishable from the first.
	 */
	claimDay(date: string, owner: string, resource: MeterResource): Promise<boolean>;
}
