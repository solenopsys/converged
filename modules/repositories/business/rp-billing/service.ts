import type {
  BillingService,
  BillingEntry,
  BillingEntryInput,
  BillingEntryId,
  BillingListParams,
  BillingTotalParams,
  PaginatedResult,
} from "./types";
import { getCurrentWorkspaceContext, isServiceActor } from "nrpc";
import { StoresController } from "./store";

const REPOSITORY_ID = "rp-billing";

/** Who is calling, from the verified token and from nothing else. */
function requireActor(): string {
  const actor = getCurrentWorkspaceContext()?.user?.trim();
  if (!actor) throw new Error("Authenticated caller is required");
  return actor;
}

/**
 * The account a new entry is filed under.
 *
 * `owner` arrives in the payload, so from a person it is a wish and not a fact:
 * they own what they are billed for. A service is believed, because a workflow
 * legitimately bills the user it runs for; if it names nobody, the entry is its
 * own.
 */
function ownerFor(claimed: string | undefined): string {
  const actor = requireActor();
  if (!isServiceActor()) return actor;
  return claimed?.trim() || actor;
}

export class BillingServiceImpl implements BillingService {
  stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
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

  addEntry(entry: BillingEntryInput): Promise<BillingEntryId> {
    return this.stores.billing.addEntry({
      ...entry,
      owner: ownerFor(entry.owner),
    });
  }

  getEntry(id: BillingEntryId): Promise<BillingEntry | undefined> {
    return this.stores.billing.getEntry(id);
  }

  listEntries(
    params: BillingListParams,
  ): Promise<PaginatedResult<BillingEntry>> {
    return this.stores.billing.listEntries(params);
  }

  total(params: BillingTotalParams): Promise<number> {
    return this.stores.billing.total(params);
  }
}
