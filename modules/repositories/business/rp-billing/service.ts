import type {
  BillingService,
  BillingEntry,
  BillingEntryInput,
  BillingEntryId,
  BillingListParams,
  BillingTotalParams,
  PaginatedResult,
} from "./types";
import { StoresController } from "./store";

const REPOSITORY_ID = "rp-billing";

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
    return this.stores.billing.addEntry(entry);
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
