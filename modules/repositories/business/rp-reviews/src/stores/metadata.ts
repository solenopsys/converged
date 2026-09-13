import {
	AccessTags,
	applyKyselyFilter,
	generateULID,
	type KyselyFilterSchema,
	type SqlStore,
	visibleFrom,
} from "back-core";
import type {
	FilterObject,
	PaginatedResult,
	Review,
	ReviewFunnel,
	ReviewId,
	ReviewInput,
	ReviewListParams,
	ReviewPatch,
	ReviewRatingCount,
	ReviewStatus,
	ReviewStatusCount,
	ReviewsDashboard,
} from "../types";

/**
 * The tag that makes moderation possible.
 *
 * A review written through the public form has no author the shop knows, so
 * nothing on it would match an identity tag and nobody could publish, answer
 * or take it down. Stamping every review with the moderator group at creation
 * is what gives the shop a hold on its own content — and only the shop, since
 * a visitor carries `public` and `public` is never an identity tag.
 */
const MODERATOR_TAG = "moderator";

const reviewFilterSchema: KyselyFilterSchema = {
	status: {
		valueType: "string",
		operators: ["eq", "in", "notEq", "notIn"],
		column: "obj.status",
	},
	rating: {
		valueType: "number",
		operators: ["eq", "in", "gte", "lte", "between"],
		column: "obj.rating",
	},
	orderId: {
		valueType: "string",
		operators: ["eq", "in", "isNull", "isNotNull"],
		column: "obj.orderId",
	},
	source: {
		valueType: "string",
		operators: ["eq", "in"],
		column: "obj.source",
	},
	externalPlatform: {
		valueType: "string",
		operators: ["eq", "in", "isNull", "isNotNull"],
		column: "obj.externalPlatform",
	},
	createdAt: {
		valueType: "date",
		operators: ["gte", "lte", "between"],
		column: "obj.createdAt",
	},
};

export class ReviewsMetadataStoreService {
	/**
	 * Who may see and who may act on a review.
	 *
	 * A review is written to be read — but it earns that on publication, not on
	 * arrival. Until then it is `authenticated`: the shop reads it in the
	 * moderation queue and a visitor does not see it at all. Publishing widens
	 * it to `public` and rejecting narrows it back, which is why those two are
	 * the only places that touch visibility.
	 */
	readonly access: AccessTags;

	constructor(private store: SqlStore) {
		this.access = new AccessTags(store);
	}

	async create(input: ReviewInput): Promise<ReviewId> {
		const id = generateULID();
		const now = new Date().toISOString();
		const status: ReviewStatus = input.status ?? "pending";
		await this.store.db
			.insertInto("reviews" as never)
			.values({
				id,
				author: input.author,
				text: input.text,
				rating: input.rating,
				orderId: input.orderId ?? null,
				requestId: input.requestId ?? null,
				contact: input.contact ?? null,
				source: input.source ?? "site",
				status,
				publishedAt: status === "published" ? now : null,
				createdAt: now,
				updatedAt: now,
			} as never)
			.execute();
		// `input.author` is a display name from the payload, not an identity: the
		// owner tag comes from the token, and for an anonymous review there is
		// none — which leaves the moderator tag as the only hold on it.
		await this.access.tagNew(id, {
			visibility: status === "published" ? "public" : "authenticated",
			tags: [MODERATOR_TAG],
		});
		return id;
	}

	async get(id: ReviewId): Promise<Review | null> {
		if (!(await this.access.canRead(id))) return null;
		const row = await this.store.db
			.selectFrom("reviews" as never)
			.selectAll()
			.where("id" as never, "=", id)
			.executeTakeFirst();
		return row ? toReview(row) : null;
	}

	async list(params: ReviewListParams): Promise<PaginatedResult<Review>> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		const items = await this.applyFilters(this.visible(), params)
			.selectAll("obj")
			.orderBy("obj.createdAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		const count = await this.applyFilters(this.visible(), params)
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();

		return {
			items: (items as any[]).map(toReview),
			totalCount: Number(count?.count ?? 0),
		};
	}

	async count(filter?: FilterObject): Promise<number> {
		const result = await applyKyselyFilter(
			this.visible(),
			filter,
			reviewFilterSchema,
		)
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();
		return Number(result?.count ?? 0);
	}

	/** Editing the text of a review is the author's or a moderator's. */
	async patch(id: ReviewId, patch: ReviewPatch): Promise<Review> {
		await this.access.requireWrite(id);
		const values: Record<string, unknown> = { updatedAt: nowIso() };
		for (const key of [
			"author",
			"text",
			"rating",
			"contact",
			"externalPlatform",
			"externalUrl",
		] as const) {
			if (patch[key] !== undefined) values[key] = patch[key];
		}
		await this.update(id, values);
		return (await this.readBack(id)) as Review;
	}

	/**
	 * Moving a review between the queue, the site and the bin.
	 *
	 * This is the one method that changes who can see the row, and it does it
	 * by moving the visibility tag rather than by trusting the status column:
	 * the column is what the shop reads, the tag is what the query selects by,
	 * and they are set together so a published review is listed to a visitor on
	 * the next request.
	 */
	async setStatus(id: ReviewId, status: ReviewStatus): Promise<Review> {
		await this.access.requireWrite(id);
		const now = nowIso();
		await this.update(id, {
			status,
			updatedAt: now,
			...(status === "published" ? { publishedAt: now } : {}),
		});
		await this.access.setVisibility(
			id,
			status === "published" ? "public" : "authenticated",
		);
		return (await this.readBack(id)) as Review;
	}

	/** The shop's answer, which travels with the review wherever it is shown. */
	async reply(id: ReviewId, reply: string, actor?: string): Promise<Review> {
		await this.access.requireWrite(id);
		const now = nowIso();
		await this.update(id, {
			reply,
			repliedAt: now,
			repliedBy: actor ?? null,
			updatedAt: now,
		});
		return (await this.readBack(id)) as Review;
	}

	/** Records that the author went on to say it publicly somewhere else. */
	async markExternal(
		id: ReviewId,
		platform: string,
		url?: string,
	): Promise<void> {
		await this.update(id, {
			externalPlatform: platform,
			externalUrl: url ?? null,
			updatedAt: nowIso(),
		});
	}

	/** Removing a review is the author's or a moderator's, not the reader's. */
	async delete(id: ReviewId): Promise<boolean> {
		await this.access.requireWrite(id);
		await this.store.db
			.deleteFrom("reviews" as never)
			.where("id" as never, "=", id)
			.execute();
		// The tags go with the row: a leftover link would later match a reused id.
		await this.access.dropObject(id);
		return true;
	}

	/**
	 * Removes a row this service itself has just written and then decided not
	 * to keep — the losing side of a raced link, and nothing else.
	 *
	 * It skips the write check because there is nobody to check: the caller is
	 * an anonymous form submission that has no identity tag, and the row it is
	 * being asked to undo is one it created microseconds earlier. Everything a
	 * user removes goes through `delete`.
	 */
	async purge(id: ReviewId): Promise<void> {
		await this.store.db
			.deleteFrom("reviews" as never)
			.where("id" as never, "=", id)
			.execute();
		await this.access.dropObject(id);
	}

	/**
	 * The numbers the reviews screen opens on.
	 *
	 * Counted over what the caller may see, like every other listing here — a
	 * visitor's average is the average of the published reviews, which is
	 * exactly what a visitor should be told.
	 */
	async dashboard(funnel: ReviewFunnel): Promise<ReviewsDashboard> {
		const rows = (await this.visible()
			.select([
				"obj.status as status",
				"obj.rating as rating",
				"obj.reply as reply",
				"obj.externalPlatform as externalPlatform",
			])
			.execute()) as Array<{
			status: string;
			rating: number;
			reply: string | null;
			externalPlatform: string | null;
		}>;

		const statusCounts = new Map<ReviewStatus, number>();
		const ratingCounts = new Map<number, number>();
		let ratingSum = 0;
		let awaitingReply = 0;
		let external = 0;

		for (const row of rows) {
			const status = (row.status ?? "pending") as ReviewStatus;
			statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
			const rating = Number(row.rating ?? 0);
			ratingCounts.set(rating, (ratingCounts.get(rating) ?? 0) + 1);
			ratingSum += rating;
			if (!row.reply && status !== "rejected") awaitingReply += 1;
			if (row.externalPlatform) external += 1;
		}

		const total = rows.length;
		return {
			total,
			averageRating: total === 0 ? 0 : round1(ratingSum / total),
			statusCounts: [...statusCounts.entries()].map(
				([status, count]): ReviewStatusCount => ({ status, count }),
			),
			ratingCounts: [...ratingCounts.entries()]
				.sort((a, b) => b[0] - a[0])
				.map(([rating, count]): ReviewRatingCount => ({ rating, count })),
			funnel,
			externalSharePercent:
				funnel.answered === 0 ? 0 : round1((external / funnel.answered) * 100),
			awaitingReply,
			pending: statusCounts.get("pending") ?? 0,
		};
	}

	/** Reviews the caller may see, as the base of the listing and its count. */
	private visible() {
		return visibleFrom(this.store.db, "reviews");
	}

	private applyFilters(query: any, params: ReviewListParams) {
		let next = query;
		if (params.status) next = next.where("obj.status", "=", params.status);
		if (params.orderId) next = next.where("obj.orderId", "=", params.orderId);
		if (params.source) next = next.where("obj.source", "=", params.source);
		if (params.rating !== undefined)
			next = next.where("obj.rating", "=", params.rating);
		if (params.minRating !== undefined)
			next = next.where("obj.rating", ">=", params.minRating);
		if (params.unanswered) next = next.where("obj.reply", "is", null);
		return applyKyselyFilter(next, params.filter, reviewFilterSchema);
	}

	private async update(id: ReviewId, values: Record<string, unknown>) {
		await this.store.db
			.updateTable("reviews" as never)
			.set(values as never)
			.where("id" as never, "=", id)
			.execute();
	}

	/**
	 * Reads a row back after writing it, without the read check.
	 *
	 * The write was already authorised a line earlier; asking again would deny
	 * the caller their own result whenever the change narrowed visibility —
	 * rejecting a review would answer `null` to the moderator who rejected it.
	 */
	private async readBack(id: ReviewId): Promise<Review | null> {
		const row = await this.store.db
			.selectFrom("reviews" as never)
			.selectAll()
			.where("id" as never, "=", id)
			.executeTakeFirst();
		return row ? toReview(row) : null;
	}
}

function nowIso(): string {
	return new Date().toISOString();
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

/** Drops the nulls SQLite hands back, so an absent field is absent. */
function toReview(row: any): Review {
	const review: Review = {
		id: row.id,
		author: row.author,
		text: row.text,
		rating: Number(row.rating ?? 0),
		status: (row.status ?? "pending") as ReviewStatus,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt ?? row.createdAt,
	};
	for (const key of [
		"orderId",
		"requestId",
		"contact",
		"source",
		"reply",
		"repliedAt",
		"repliedBy",
		"externalPlatform",
		"externalUrl",
		"publishedAt",
	] as const) {
		if (row[key] !== null && row[key] !== undefined)
			(review as any)[key] = row[key];
	}
	return review;
}
