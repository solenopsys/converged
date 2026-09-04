import { SqlStore, generateULID } from "back-core";
import type {
  Review,
  ReviewId,
  ReviewInput,
  PaginationParams,
  PaginatedResult,
} from "../types";

export class ReviewsMetadataStoreService {
  constructor(private store: SqlStore) {}

  async create(input: ReviewInput): Promise<ReviewId> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    await this.store.db
      .insertInto("reviews")
      .values({
        id,
        author: input.author,
        text: input.text,
        rating: input.rating,
        createdAt,
      })
      .execute();
    return id;
  }

  async get(id: ReviewId): Promise<Review | null> {
    const row = await this.store.db
      .selectFrom("reviews")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? (row as Review) : null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Review>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.store.db
      .selectFrom("reviews")
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const count = await this.store.db
      .selectFrom("reviews")
      .select(({ fn }) => fn.countAll().as("count"))
      .executeTakeFirst();

    return {
      items: items as Review[],
      totalCount: Number(count?.count ?? 0),
    };
  }

  async delete(id: ReviewId): Promise<boolean> {
    await this.store.db.deleteFrom("reviews").where("id", "=", id).execute();
    return true;
  }
}
