import { createDomain, sample } from "effector";
import type { Order } from "g-orders";
import type {
	Review,
	ReviewInvite,
	ReviewSettings,
	ReviewStatus,
	ReviewsDashboard,
} from "g-reviews";
import { ordersClient, reviewsClient } from "./services";

const domain = createDomain("sf-reviews");

export const reviewsViewMounted = domain.createEvent("REVIEWS_VIEW_MOUNTED");
export const refreshClicked = domain.createEvent("REVIEWS_REFRESH_CLICKED");
export const reviewOpened = domain.createEvent<{ reviewId: string }>(
	"REVIEWS_REVIEW_OPENED",
);
export const reviewChanged = domain.createEvent<Review>(
	"REVIEWS_REVIEW_CHANGED",
);

// ---- the surface's own screen ----------------------------------------------

/**
 * What the reviews area opens on: the numbers, the moderation queue and the
 * links still in flight. Three reads rather than one, because the funnel and
 * the reviews are separate questions and only this screen wants both.
 */
export const loadOverviewFx = domain.createEffect({
	name: "LOAD_REVIEWS_OVERVIEW",
	handler: async (): Promise<{
		dashboard: ReviewsDashboard;
		queue: Review[];
		invites: ReviewInvite[];
		settings: ReviewSettings;
	}> => {
		const [dashboard, queue, invites, settings] = await Promise.all([
			reviewsClient.getReviewsDashboard(),
			reviewsClient.listReviews({ offset: 0, limit: 50, status: "pending" }),
			reviewsClient.listInvites({ offset: 0, limit: 50 }),
			reviewsClient.getSettings(),
		]);
		return {
			dashboard,
			queue: queue.items ?? [],
			invites: invites.items ?? [],
			settings,
		};
	},
});

export type OverviewState = {
	dashboard?: ReviewsDashboard;
	queue: Review[];
	invites: ReviewInvite[];
	settings?: ReviewSettings;
	loading: boolean;
	error?: string;
};

export const $overview = domain
	.createStore<OverviewState>(
		{ queue: [], invites: [], loading: false },
		{ name: "REVIEWS_OVERVIEW" },
	)
	.on(loadOverviewFx, (state) => ({
		...state,
		loading: true,
		error: undefined,
	}))
	.on(loadOverviewFx.doneData, (state, data) => ({
		...state,
		...data,
		loading: false,
	}))
	.on(loadOverviewFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: error.message,
	}))
	// A review passed or answered in its card must not sit in the queue behind it.
	.on(reviewChanged, (state, review) => ({
		...state,
		queue:
			review.status === "pending"
				? state.queue.map((entry) => (entry.id === review.id ? review : entry))
				: state.queue.filter((entry) => entry.id !== review.id),
	}));

sample({ clock: [reviewsViewMounted, refreshClicked], target: loadOverviewFx });

// ---- one review -------------------------------------------------------------

export type ReviewState = {
	reviewId?: string;
	review?: Review;
	/** The work it is about, when the review came through a link. */
	order?: Order;
	settings?: ReviewSettings;
	loading: boolean;
	error?: string;
};

export const loadReviewFx = domain.createEffect({
	name: "LOAD_REVIEW",
	handler: async (
		reviewId: string,
	): Promise<Omit<ReviewState, "loading" | "error">> => {
		const review = await reviewsClient.getReview(reviewId);
		const settings = await reviewsClient.getSettings();
		// A review may name an order that has since been removed; that is not a
		// reason for the card to fail, only for it to show one section less.
		const order = review?.orderId
			? await ordersClient.getOrder(review.orderId).catch(() => undefined)
			: undefined;
		return {
			reviewId,
			review: review ?? undefined,
			order: order ?? undefined,
			settings,
		};
	},
});

export const $review = domain
	.createStore<ReviewState>({ loading: false }, { name: "REVIEWS_REVIEW" })
	.on(reviewOpened, (state, { reviewId }) =>
		state.reviewId === reviewId ? state : { reviewId, loading: true },
	)
	.on(loadReviewFx, (state) => ({ ...state, loading: true, error: undefined }))
	.on(loadReviewFx.doneData, (state, data) => ({
		...state,
		...data,
		loading: false,
	}))
	.on(loadReviewFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: error.message,
	}))
	.on(reviewChanged, (state, review) =>
		state.reviewId === review.id ? { ...state, review } : state,
	);

sample({
	clock: reviewOpened,
	fn: ({ reviewId }) => reviewId,
	target: loadReviewFx,
});

/** Refresh re-reads whichever review is open, not just the overview. */
sample({
	clock: refreshClicked,
	source: $review,
	filter: (state): state is ReviewState & { reviewId: string } =>
		Boolean(state.reviewId),
	fn: (state) => state.reviewId as string,
	target: loadReviewFx,
});

// ---- writes -----------------------------------------------------------------

export const setStatusFx = domain.createEffect({
	name: "SET_REVIEW_STATUS",
	handler: (input: { id: string; status: ReviewStatus }) =>
		reviewsClient.setStatus(input.id, input.status),
});

export const replyFx = domain.createEffect({
	name: "REPLY_TO_REVIEW",
	handler: (input: { id: string; reply: string }) =>
		reviewsClient.replyToReview(input.id, input.reply),
});

// Publishing or answering changes both the card and the counts behind it.
sample({
	clock: [setStatusFx.doneData, replyFx.doneData],
	target: reviewChanged,
});
sample({ clock: [setStatusFx.done, replyFx.done], target: loadOverviewFx });

// ---- derived ----------------------------------------------------------------

/**
 * Where a review of this rating would be pointed on the public form.
 *
 * The platforms are shown to everybody either way — the threshold moves the
 * emphasis, not the links — so this is what the card says about a review, not
 * a gate it applies to one.
 */
export function isPositive(rating: number, settings?: ReviewSettings): boolean {
	return rating >= (settings?.positiveThreshold ?? 4);
}
