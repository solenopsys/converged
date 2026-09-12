import { AccessTags, SqlStore, generateULID, visibleFrom } from "back-core";
import type {
  Review,
  ReviewId,
  ReviewInput,
  PaginationParams,
  PaginatedResult,
} from "../types";

export class ReviewsMetadataStoreService {
  /**
   * Who may see and who may remove a review.
   *
   * A review is written to be read, so it is created `public` — it stays
   * visible to a visitor with no token, which is the whole point of it. The
   * tags carry the other half: the author's own tag, so that taking a review
   * down is the author's or a moderator's, and not anybody's who knows the id.
   */
  readonly access: AccessTags;

  constructor(private store: SqlStore) {
    this.access = new AccessTags(store);
  }

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
    // `input.author` is a display name from the payload, not an identity: the
    // owner tag comes from the token, and for an anonymous review there is
    // none, which leaves it public and removable only by a moderator tag.
    await this.access.tagNew(id, { visibility: "public" });
    return id;
  }

  async get(id: ReviewId): Promise<Review | null> {
    if (!(await this.access.canRead(id))) return null;
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

    const items = await this.visible()
      .selectAll("obj")
      .orderBy("obj.createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const count = await this.visible()
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();

    return {
      items: items as Review[],
      totalCount: Number(count?.count ?? 0),
    };
  }

  /** Removing a review is the author's or a moderator's, not the reader's. */
  async delete(id: ReviewId): Promise<boolean> {
    await this.access.requireWrite(id);
    await this.store.db.deleteFrom("reviews").where("id", "=", id).execute();
    // The tags go with the row: a leftover link would later match a reused id.
    await this.access.dropObject(id);
    return true;
  }

  /** Reviews the caller may see, as the base of the listing and its count. */
  private visible() {
    return visibleFrom(this.store.db, "reviews");
  }
}
