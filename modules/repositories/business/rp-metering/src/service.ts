import { Access, getCurrentWorkspaceContext, isServiceActor } from "nrpc";
import type {
	MeterDailyItem,
	MeterDailyParams,
	MeterResource,
	MeterSampleInput,
	MeteringService,
} from "./types";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-metering";

/** Who is calling, from the verified token and from nothing else. */
function requireActor(): string {
	const actor = getCurrentWorkspaceContext()?.user?.trim();
	if (!actor) {
		const error: any = new Error("Authenticated caller is required");
		error.statusCode = 401;
		throw error;
	}
	return actor;
}

/**
 * The account consumption is filed under — the same rule as `rp-billing`'s
 * `ownerFor`, because these rows become that repository's entries. A person
 * only ever meters themselves; a service meters whoever it ran for.
 */
function ownerFor(claimed: string | undefined): string {
	const actor = requireActor();
	if (!isServiceActor()) return actor;
	return claimed?.trim() || actor;
}

export class MeteringServiceImpl implements MeteringService {
	private stores!: StoresController;
	private initPromise: Promise<void>;

	constructor() {
		this.initPromise = this.init();
	}

	async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(REPOSITORY_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	// Metering is what the invoice is made of, so nobody may hand-write it: the
	// samples come from whatever actually spent the resource.
	@Access("internal")
	async record(samples: MeterSampleInput[]): Promise<{ inserted: number }> {
		await this.ensureReady();
		if (!samples?.length) {
			return { inserted: 0 };
		}

		const resolved = samples.map((sample) => {
			if (!sample?.resource || !Number.isFinite(sample.amount)) {
				const error: any = new Error("resource and a numeric amount are required");
				error.statusCode = 400;
				throw error;
			}
			return { ...sample, owner: ownerFor(sample.owner) };
		});

		return { inserted: await this.stores.meter.record(resolved) };
	}

	/**
	 * A person sees their own consumption and only their own — naming another
	 * owner narrows nothing, it is simply ignored. A service may ask about
	 * anybody, which is how the daily charge job walks every account.
	 */
	@Access("user")
	async dailyTotals(params?: MeterDailyParams): Promise<MeterDailyItem[]> {
		await this.ensureReady();
		const asked = params ?? {};
		const owner = isServiceActor() ? asked.owner : requireActor();
		return this.stores.meter.dailyTotals({ ...asked, owner });
	}

	@Access("internal")
	async claimDay(date: string, owner: string, resource: MeterResource): Promise<boolean> {
		await this.ensureReady();
		return this.stores.meter.claimDay(date, owner, resource);
	}

	private async ensureReady(): Promise<void> {
		await this.initPromise;
	}
}

export default MeteringServiceImpl;
