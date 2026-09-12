import { AccessTags, SqlStore, visibleFrom } from "back-core";
import { BillingEntryRepository } from "./entities";
import { generateULID } from "back-core";
import type {
  BillingEntry,
  BillingEntryInput,
  BillingEntryId,
  BillingListParams,
  BillingTotalParams,
  PaginatedResult,
} from "../../types";

export class BillingStoreService {
  private readonly repo: BillingEntryRepository;
  /**
   * Who may see which entry.
   *
   * A billing entry is one account's own, so it is `private`: the tag of the
   * owner it is filed under, and nothing else. Whoever bills across accounts —
   * support, finance — does it through a group tag on the entries they handle,
   * which is what `owner` as a filter could never express, because filtering by
   * an owner you name is not the same as being allowed to.
   */
  readonly access: AccessTags;

  constructor(private store: SqlStore) {
    this.access = new AccessTags(store);
    this.repo = new BillingEntryRepository(store, "billing_entries", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  /**
   * `owner` is resolved by the caller of this store (see `service.ts`): from the
   * token for a person, from the payload only for a service filing on someone's
   * behalf. By the time it arrives here it is a fact, and it is what the entry
   * is tagged with.
   */
  async addEntry(entry: BillingEntryInput): Promise<BillingEntryId> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    const entity: BillingEntry = {
      id,
      owner: entry.owner,
      category: entry.category,
      amount: entry.amount,
      currency: entry.currency ?? "USD",
      description: entry.description ?? "",
      createdAt,
    };

    await this.repo.create(entity as any);
    await this.access.tagNew(id, { visibility: "private", owner: entry.owner });
    return id;
  }

  /** An entry the caller holds no tag for reads as absent. */
  async getEntry(id: BillingEntryId): Promise<BillingEntry | undefined> {
    if (!(await this.access.canRead(id))) return undefined;
    return this.repo.findById({ id });
  }

  async listEntries(
    params: BillingListParams,
  ): Promise<PaginatedResult<BillingEntry>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.applyFilters(this.visible(), params)
      .selectAll("obj")
      .orderBy("obj.createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const countResult = await this.applyFilters(this.visible(), params)
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: items as BillingEntry[],
      totalCount,
    };
  }

  /**
   * The sum over what the caller may see. Asking for another account's total is
   * the cheapest way to learn what it spends, so the narrowing runs here too
   * and `params.owner` only ever narrows further.
   */
  async total(params: BillingTotalParams): Promise<number> {
    const result = await this.applyFilters(this.visible(), params)
      .select((eb: any) => eb.fn.sum("obj.amount").as("total"))
      .executeTakeFirst();
    return Number(result?.total ?? 0);
  }

  /** Entries the caller may see, as the base of every listing and total. */
  private visible() {
    return visibleFrom(this.store.db, "billing_entries");
  }

  private applyFilters(query: any, params: BillingTotalParams) {
    let current = query;
    if (params.owner) {
      current = current.where("obj.owner", "=", params.owner);
    }
    if (params.category) {
      current = current.where("obj.category", "=", params.category);
    }
    if (params.from) {
      current = current.where("obj.createdAt", ">=", params.from);
    }
    if (params.to) {
      current = current.where("obj.createdAt", "<=", params.to);
    }
    return current;
  }
}
