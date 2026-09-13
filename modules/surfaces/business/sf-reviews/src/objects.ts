import { EntityListView } from "front-core";
import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import type {
	ReviewInviteListParams,
	ReviewListParams,
	ReviewStatus,
} from "g-reviews";
import { inviteColumns, reviewColumns } from "./config";
import { reviewChanged } from "./domain-reviews";
import { reviewsClient } from "./services";
import { ReviewsSummary } from "./summary";
import { ReviewDetailView } from "./views/ReviewDetailView";
import { ReviewsDashboardView } from "./views/ReviewsDashboardView";

// Reviews as one working area.
//
// Two `setOf` views — reviews and the invitations that asked for them — which
// the workspace turns into the permanent buttons of this tab, and one `objectOf`
// view for a review, which opens as a closable button *inside the same tab*.
// The moderation queue, the published wall and the rejected pile are presets on
// the reviews table rather than three types, because they are one list read
// three ways; the invitations are a different question and so a list of their
// own. With nothing pressed the surface shows its own screen.

const STATUS_OPTIONS: Array<{ value: ReviewStatus; label: string }> = [
	{ value: "pending", label: "On moderation" },
	{ value: "published", label: "Published" },
	{ value: "rejected", label: "Rejected" },
];

export const objects = [
	{
		id: "reviews.review",
		label: "Review",
		pluralLabel: "Reviews",
		description:
			"What a customer said about one piece of work, and what the shop said back",
		categories: [Category.Business, Category.Selectable, Category.Editable],
		selection: {
			filters: [
				{
					id: "status",
					label: "Status",
					valueType: "string",
					operators: ["eq", "in"],
					control: "select",
					options: STATUS_OPTIONS.map((option) => ({
						id: option.value,
						label: option.label,
					})),
				},
				{
					id: "rating",
					label: "Rating",
					valueType: "number",
					operators: ["eq", "gte", "lte", "between"],
				},
			],
			load: (params) => reviewsClient.listReviews(params),
		},
		infinity: {
			tableId: "reviews",
			title: "Reviews",
			columns: reviewColumns,
			load: (params) => reviewsClient.listReviews(params as ReviewListParams),
			rowRef: (row) => {
				const review = row as {
					id?: unknown;
					author?: unknown;
					rating?: unknown;
				};
				const id = String(review.id ?? "");
				return objectRef("reviews.review", id, {
					title:
						(typeof review.author === "string" && review.author) ||
						`Review ${id}`,
				});
			},
			filters: [
				{
					id: "status",
					label: "Status",
					type: "select",
					operator: "eq",
					options: STATUS_OPTIONS.map((option) => ({
						value: option.value,
						label: option.label,
					})),
				},
				{ id: "orderId", label: "Order", type: "search", operator: "eq" },
				{
					id: "source",
					label: "Source",
					type: "select",
					operator: "eq",
					options: [
						{ value: "site", label: "Site" },
						{ value: "invite", label: "Invitation" },
						{ value: "staff", label: "Entered by staff" },
						{ value: "external", label: "External" },
					],
				},
			],
			// The queue first: it is the only one of the three that needs somebody.
			presets: [
				{
					id: "reviews.pending",
					label: "On moderation",
					control: "tab",
					group: "reviews-status",
					defaults: { status: "pending" },
				},
				{
					id: "reviews.published",
					label: "Published",
					control: "tab",
					group: "reviews-status",
					defaults: { status: "published" },
				},
				{
					id: "reviews.rejected",
					label: "Rejected",
					control: "tab",
					group: "reviews-status",
					defaults: { status: "rejected" },
				},
				{
					id: "reviews.all",
					label: "All",
					control: "tab",
					group: "reviews-status",
				},
			],
			mobile: { title: "author", subtitle: "text", badge: "status" },
		},
	},
	{
		id: "reviews.invite",
		label: "Invitation",
		pluralLabel: "Invitations",
		description: "One personal link asking for a review, and what became of it",
		categories: [Category.Business, Category.Selectable],
		selection: {
			filters: [],
			load: (params) => reviewsClient.listInvites(params),
		},
		infinity: {
			tableId: "review-invites",
			title: "Invitations",
			columns: inviteColumns,
			load: (params) =>
				reviewsClient.listInvites(params as ReviewInviteListParams),
			// A link is not a thing to open; the order it is about is.
			rowRef: (row) => {
				const invite = row as { orderId?: unknown };
				return objectRef("orders.order", String(invite.orderId ?? ""));
			},
			filters: [
				{
					id: "status",
					label: "Status",
					type: "select",
					operator: "eq",
					options: [
						{ value: "queued", label: "Queued" },
						{ value: "sent", label: "Sent" },
						{ value: "opened", label: "Opened" },
						{ value: "answered", label: "Answered" },
						{ value: "expired", label: "Expired" },
						{ value: "failed", label: "Failed" },
					],
				},
				{ id: "orderId", label: "Order", type: "search", operator: "eq" },
			],
		},
	},
	{
		id: "reviews.statistic.summary",
		label: "Reviews",
		categories: [Category.Statistic, Category.Business],
		statistic: { role: "summary", component: ReviewsSummary },
	},
	{
		// The surface's own screen. A statistical type with no `component` is
		// resolved through its `setOf` view, which the shell then gives the full
		// row — so the funnel overview is what this tab shows when no button is
		// pressed, and a button of its own besides.
		id: "reviews.statistic",
		label: "Overview",
		pluralLabel: "Overview",
		categories: [Category.Statistic, Category.Business],
	},
] satisfies readonly ObjectDefinition[];

/** The one reference every moderation operation needs. */
function reviewIdOf(references: readonly { kind: string }[]): string {
	const ref = references.find(
		(item: any) => item.kind === "object" && item.type === "reviews.review",
	) as { kind: string; id?: string } | undefined;
	if (ref?.kind !== "object" || !ref.id)
		throw new Error("Review reference is required");
	return ref.id;
}

export default defineSurface({
	id: "sf-reviews",
	label: "Reviews",
	purpose:
		"What customers said about the work, which of it is on the site, and how the asking is going",
	types: objects,
	views: [
		{
			id: "reviews.review.detail",
			accepts: objectOf("reviews.review"),
			component: ReviewDetailView,
			props: (ref) => ({
				reviewId: ref.kind === "object" ? ref.id : undefined,
			}),
		},
		{
			id: "reviews.review.table",
			label: "Reviews",
			accepts: setOf("reviews.review"),
			component: EntityListView,
		},
		{
			id: "reviews.invite.table",
			label: "Invitations",
			accepts: setOf("reviews.invite"),
			component: EntityListView,
		},
		{
			id: "reviews.statistic.dashboard",
			label: "Overview",
			accepts: setOf("reviews.statistic"),
			component: ReviewsDashboardView,
		},
	],
	operations: [
		{
			id: "reviews.review.publish",
			operator: "execute",
			target: "reviews.review",
			label: "Publish review",
			description:
				"Put a review on the site. Until this, it is visible only in this console.",
			inputs: [{ name: "review", accepts: objectOf("reviews.review") }],
			invoke: async ({ references }) => {
				const review = await reviewsClient.setStatus(
					reviewIdOf(references),
					"published",
				);
				if (review) reviewChanged(review);
				return review;
			},
		},
		{
			id: "reviews.review.reject",
			operator: "execute",
			target: "reviews.review",
			label: "Reject review",
			description: "Keep a review out of the site. It stays readable here.",
			inputs: [{ name: "review", accepts: objectOf("reviews.review") }],
			invoke: async ({ references }) => {
				const review = await reviewsClient.setStatus(
					reviewIdOf(references),
					"rejected",
				);
				if (review) reviewChanged(review);
				return review;
			},
		},
		{
			id: "reviews.review.reply",
			operator: "execute",
			target: "reviews.review",
			label: "Answer review",
			description:
				"The shop's answer, which travels with the review wherever it is shown",
			inputs: [{ name: "review", accepts: objectOf("reviews.review") }],
			parameters: {
				type: "object",
				properties: { reply: { type: "string" } },
				required: ["reply"],
			},
			invoke: async ({ references, params }) => {
				const review = await reviewsClient.replyToReview(
					reviewIdOf(references),
					String(params.reply ?? ""),
				);
				if (review) reviewChanged(review);
				return review;
			},
		},
		{
			// Somebody who phoned in a review, or one copied off a platform. It is
			// created `pending` like any other: entering a review is not passing it.
			id: "reviews.review.create",
			operator: "create",
			target: "reviews.review",
			label: "Record a review",
			description:
				"Enter a review the shop received elsewhere — by phone, in person, or on a platform.",
			output: objectOf("reviews.review"),
			parameters: {
				type: "object",
				properties: {
					author: { type: "string" },
					text: { type: "string" },
					rating: { type: "number", description: "1 to 5" },
					orderId: { type: "string" },
					contact: { type: "string" },
					externalPlatform: {
						type: "string",
						description: "Platform it was copied from, if any",
					},
				},
				required: ["author", "text", "rating"],
			},
			presentOutput: true,
			invoke: async ({ params }) => {
				const id = await reviewsClient.createReview({
					author: String(params.author),
					text: String(params.text),
					rating: Number(params.rating),
					...(params.orderId ? { orderId: String(params.orderId) } : {}),
					...(params.contact ? { contact: String(params.contact) } : {}),
					source: params.externalPlatform ? "external" : "staff",
				});
				if (params.externalPlatform) {
					await reviewsClient.patchReview(id, {
						externalPlatform: String(params.externalPlatform),
					});
				}
				return objectRef("reviews.review", id, {
					title: String(params.author),
				});
			},
		},
		{
			// Asking one customer now, rather than waiting for the schedule. The
			// link is minted here and sent by wf-order-review-request on its next
			// run, which is what keeps one sender and one trail.
			id: "reviews.invite.create",
			operator: "create",
			target: "reviews.invite",
			label: "Ask for a review",
			description: "Mint a personal review link for one order and one address.",
			parameters: {
				type: "object",
				properties: {
					orderId: { type: "string" },
					contact: { type: "string", description: "Where to send it" },
					lang: { type: "string" },
				},
				required: ["orderId", "contact"],
			},
			invoke: ({ params }) =>
				reviewsClient.createInvite({
					orderId: String(params.orderId),
					contact: String(params.contact),
					...(params.lang ? { lang: String(params.lang) } : {}),
				}),
		},
		{
			id: "reviews.review.delete",
			operator: "delete",
			target: "reviews.review",
			label: "Remove review",
			inputs: [{ name: "review", accepts: objectOf("reviews.review") }],
			invoke: ({ references }) =>
				reviewsClient.deleteReview(reviewIdOf(references)),
		},
	],
});
