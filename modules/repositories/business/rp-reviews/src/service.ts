import { getCurrentWorkspaceContext } from "nrpc";
import { StoresController } from "./stores";
import type {
	FilterObject,
	PaginatedResult,
	Review,
	ReviewId,
	ReviewInput,
	ReviewInvite,
	ReviewInviteId,
	ReviewInviteInput,
	ReviewInviteListParams,
	ReviewInvitePatch,
	ReviewInviteView,
	ReviewListParams,
	ReviewPatch,
	ReviewSettings,
	ReviewSettingsPatch,
	ReviewStatus,
	ReviewSubmission,
	ReviewsDashboard,
	ReviewsService,
	SelectionDescriptor,
	SelectionStats,
} from "./types";

const REPOSITORY_ID = "rp-reviews";

export class ReviewsServiceImpl implements ReviewsService {
	private stores: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	private async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(REPOSITORY_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	private async ready(): Promise<void> {
		await this.init();
	}

	async createReview(input: ReviewInput): Promise<ReviewId> {
		await this.ready();
		return this.stores.metadata.create(input);
	}

	async getReview(id: ReviewId): Promise<Review | null> {
		await this.ready();
		return this.stores.metadata.get(id);
	}

	async listReviews(
		params: ReviewListParams,
	): Promise<PaginatedResult<Review>> {
		await this.ready();
		return this.stores.metadata.list(params);
	}

	async patchReview(id: ReviewId, patch: ReviewPatch): Promise<Review> {
		await this.ready();
		return this.stores.metadata.patch(id, patch);
	}

	async setStatus(id: ReviewId, status: ReviewStatus): Promise<Review> {
		await this.ready();
		return this.stores.metadata.setStatus(id, status);
	}

	async replyToReview(id: ReviewId, reply: string): Promise<Review> {
		await this.ready();
		// Who answered comes from the token, not from the payload: an answer
		// signed by whoever the caller claims to be is worth nothing.
		const actor = getCurrentWorkspaceContext()?.user?.trim();
		return this.stores.metadata.reply(id, reply, actor);
	}

	async deleteReview(id: ReviewId): Promise<boolean> {
		await this.ready();
		return this.stores.metadata.delete(id);
	}

	async describeSelection(objectType: string): Promise<SelectionDescriptor> {
		if (objectType !== "reviews.review") {
			throw new Error(`Unsupported review selection object: ${objectType}`);
		}
		return {
			objectType,
			title: "Reviews",
			fields: [
				{
					id: "status",
					label: "Status",
					valueType: "enum",
					operators: ["eq", "in", "notEq", "notIn"],
				},
				{
					id: "rating",
					label: "Rating",
					valueType: "number",
					operators: ["eq", "in", "gte", "lte", "between"],
				},
				{
					id: "orderId",
					label: "Order",
					valueType: "string",
					operators: ["eq", "in", "isNull", "isNotNull"],
				},
				{
					id: "source",
					label: "Source",
					valueType: "string",
					operators: ["eq", "in"],
				},
				{
					id: "externalPlatform",
					label: "External platform",
					valueType: "string",
					operators: ["eq", "in", "isNull", "isNotNull"],
				},
				{
					id: "createdAt",
					label: "Received",
					valueType: "date",
					operators: ["gte", "lte", "between"],
				},
			],
			filterExample: { status: { eq: "pending" } },
			revision: "reviews-v1",
		};
	}

	async inspectReviews(filter?: FilterObject): Promise<SelectionStats> {
		await this.ready();
		return { totalCount: await this.stores.metadata.count(filter) };
	}

	async getReviewsDashboard(): Promise<ReviewsDashboard> {
		await this.ready();
		return this.stores.metadata.dashboard(await this.stores.invites.funnel());
	}

	async createInvite(input: ReviewInviteInput): Promise<ReviewInvite> {
		await this.ready();
		const settings = await this.stores.settings.get();
		return this.stores.invites.create(input, settings.inviteTtlDays);
	}

	async listInvites(
		params: ReviewInviteListParams,
	): Promise<PaginatedResult<ReviewInvite>> {
		await this.ready();
		return this.stores.invites.list(params);
	}

	async patchInvite(
		id: ReviewInviteId,
		patch: ReviewInvitePatch,
	): Promise<void> {
		await this.ready();
		return this.stores.invites.patch(id, patch);
	}

	async findInvitesToFollowUp(
		days: number,
		maxFollowups: number,
		limit: number,
	): Promise<ReviewInvite[]> {
		await this.ready();
		return this.stores.invites.toFollowUp(days, maxFollowups, limit ?? 20);
	}

	async getInviteByToken(token: string): Promise<ReviewInviteView | null> {
		await this.ready();
		return this.stores.invites.byToken(token);
	}

	async markInviteOpened(token: string): Promise<ReviewInviteView | null> {
		await this.ready();
		return this.stores.invites.markOpened(token);
	}

	/**
	 * The public form's one write.
	 *
	 * The link is spent first and the review is written second, so a link that
	 * has already been used produces nothing at all rather than a review the
	 * shop cannot trace. The review arrives `pending`: it came from outside and
	 * is nobody's to publish but the shop's.
	 */
	async submitByToken(
		token: string,
		submission: ReviewSubmission,
	): Promise<ReviewId | null> {
		await this.ready();
		const invite = await this.stores.invites.byToken(token);
		if (!invite?.usable) return null;

		const id = await this.stores.metadata.create({
			author: submission.author?.trim() || "Customer",
			text: submission.text,
			rating: submission.rating,
			orderId: invite.orderId,
			contact: submission.contact,
			source: "invite",
			status: "pending",
		});

		if (!(await this.stores.invites.consume(token, id))) {
			// Somebody else spent the link between the check and the write; the
			// review that lost the race is removed rather than left orphaned.
			await this.stores.metadata.purge(id);
			return null;
		}

		if (submission.externalPlatform) {
			await this.stores.metadata.markExternal(id, submission.externalPlatform);
		}
		return id;
	}

	async getSettings(): Promise<ReviewSettings> {
		await this.ready();
		return this.stores.settings.get();
	}

	async saveSettings(patch: ReviewSettingsPatch): Promise<ReviewSettings> {
		await this.ready();
		return this.stores.settings.save(patch);
	}
}

export default ReviewsServiceImpl;
