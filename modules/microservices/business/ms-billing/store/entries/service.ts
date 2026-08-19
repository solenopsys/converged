import { SqlStore } from "back-core";
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

  constructor(private store: SqlStore) {
    this.repo = new BillingEntryRepository(store, "billing_entries", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

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
    return id;
  }

  async getEntry(id: BillingEntryId): Promise<BillingEntry | undefined> {
    return this.repo.findById({ id });
  }

  async listEntries(
    params: BillingListParams,
  ): Promise<PaginatedResult<BillingEntry>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("billing_entries").selectAll();
    query = this.applyFilters(query, params);

    const items = await query
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("billing_entries")
      .select(({ fn }) => fn.countAll().as("count"));
    countQuery = this.applyFilters(countQuery, params);

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: items as BillingEntry[],
      totalCount,
    };
  }

  async total(params: BillingTotalParams): Promise<number> {
    let query = this.store.db
      .selectFrom("billing_entries")
      .select(({ fn }) => fn.sum("amount").as("total"));

    query = this.applyFilters(query, params);

    const result = await query.executeTakeFirst();
    return Number(result?.total ?? 0);
  }

  private applyFilters(query: any, params: BillingTotalParams) {
    let current = query;
    if (params.owner) {
      current = current.where("owner", "=", params.owner);
    }
    if (params.category) {
      current = current.where("category", "=", params.category);
    }
    if (params.from) {
      current = current.where("createdAt", ">=", params.from);
    }
    if (params.to) {
      current = current.where("createdAt", "<=", params.to);
    }
    return current;
  }
}
