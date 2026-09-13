import { useUnit } from "effector-preact";
import { objectRef, presentReference } from "front-core/object-runtime";
import type { Order } from "g-orders";
import { useEffect, useState } from "preact/compat";
import { reviewSourceConfig, reviewStatusConfig } from "../config";
import {
	$review,
	isPositive,
	replyFx,
	reviewOpened,
	setStatusFx,
} from "../domain-reviews";

// One review, as moderation asks about it: what was said, about which work,
// whether it is on the site, and what the shop said back. It opens as a subtab
// of this surface, so whoever is working the queue is still inside "reviews".

function formatDate(value?: string): string {
	if (!value) return "—";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function stars(rating: number): string {
	const whole = Math.max(0, Math.min(5, Math.round(rating)));
	return "★".repeat(whole) + "☆".repeat(5 - whole);
}

function Field({ label, value }: { label: string; value: unknown }) {
	return (
		<div class="flex flex-col gap-0.5">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{label}
			</span>
			<span class="text-sm">
				{value === undefined || value === null || value === ""
					? "—"
					: String(value)}
			</span>
		</div>
	);
}

/** The work this review is about, as a way into that order. */
function AboutOrder({ order }: { order: Order }) {
	return (
		<button
			type="button"
			onClick={() =>
				void presentReference(
					objectRef("orders.order", order.id, { title: order.modelName }),
				)
			}
			class="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
		>
			<Field label="Order" value={order.modelName} />
			<Field label="Method" value={order.productionMethod} />
			<Field label="Quantity" value={order.quantity} />
			<Field label="Customer" value={order.customerName} />
		</button>
	);
}

export function ReviewDetailView({ reviewId }: { reviewId?: string }) {
	const state = useUnit($review);
	const statusPending = useUnit(setStatusFx.pending);
	const replyPending = useUnit(replyFx.pending);
	const [draft, setDraft] = useState("");

	useEffect(() => {
		if (reviewId) reviewOpened({ reviewId });
	}, [reviewId]);

	const review = state.review;

	// The draft follows whichever review is open, so switching subtabs does not
	// carry half an answer to the next customer.
	useEffect(() => {
		setDraft(review?.reply ?? "");
	}, [review?.id, review?.reply]);

	if (!reviewId) {
		return (
			<div class="p-4 text-sm text-muted-foreground">No review selected.</div>
		);
	}
	if (state.loading && !review) {
		return <div class="p-4 text-sm text-muted-foreground">Loading…</div>;
	}
	if (state.error) {
		return <div class="p-4 text-sm text-rose-700">{state.error}</div>;
	}
	if (!review) {
		return (
			<div class="p-4 text-sm text-muted-foreground">Review not found.</div>
		);
	}

	const statusStyle = reviewStatusConfig[review.status];
	const sourceStyle = review.source
		? reviewSourceConfig[review.source]
		: undefined;
	const positive = isPositive(review.rating, state.settings);

	return (
		<div class="flex flex-col gap-4 p-4">
			<header class="flex flex-wrap items-center gap-3">
				<h1 class="text-lg font-semibold">{review.author}</h1>
				<span class="text-sm text-amber-600">{stars(review.rating)}</span>
				<span
					class={`rounded px-2 py-0.5 text-xs font-medium ${statusStyle?.className ?? ""}`}
				>
					{statusStyle?.label ?? review.status}
				</span>
				{sourceStyle ? (
					<span
						class={`rounded px-2 py-0.5 text-xs font-medium ${sourceStyle.className}`}
					>
						{sourceStyle.label}
					</span>
				) : null}
			</header>

			<section class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					disabled={statusPending || review.status === "published"}
					onClick={() => setStatusFx({ id: review.id, status: "published" })}
					class="rounded border border-border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
				>
					Publish
				</button>
				<button
					type="button"
					disabled={statusPending || review.status === "rejected"}
					onClick={() => setStatusFx({ id: review.id, status: "rejected" })}
					class="rounded border border-border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
				>
					Reject
				</button>
				{review.status !== "pending" ? (
					<button
						type="button"
						disabled={statusPending}
						onClick={() => setStatusFx({ id: review.id, status: "pending" })}
						class="rounded border border-border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
					>
						Back to moderation
					</button>
				) : null}
				<span class="text-xs text-muted-foreground">
					{review.status === "published"
						? "Visible to anyone on the site."
						: "Not visible outside this console."}
				</span>
			</section>

			<section class="rounded-lg border border-border bg-card p-3 text-sm whitespace-pre-wrap">
				{review.text}
			</section>

			<section class="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-3 md:grid-cols-4">
				<Field label="Received" value={formatDate(review.createdAt)} />
				<Field label="Published" value={formatDate(review.publishedAt)} />
				<Field label="Contact" value={review.contact} />
				<Field
					label="Shared on"
					value={review.externalPlatform ?? "Kept to the site"}
				/>
			</section>

			{/* Which way the public form leaned for this rating. It is a statement
			    about emphasis, not about access: the platform links are shown to
			    everybody, because showing them only to happy customers is what the
			    platforms themselves forbid. */}
			<p class="text-xs text-muted-foreground">
				{positive
					? "At or above the shop's threshold — the form offered the public platforms first."
					: "Below the shop's threshold — the form offered a word with the shop first, with the platforms still shown."}
			</p>

			{state.order ? (
				<section class="flex flex-col gap-2">
					<h2 class="text-sm font-semibold">About</h2>
					<AboutOrder order={state.order} />
				</section>
			) : review.orderId ? (
				<p class="text-sm text-muted-foreground">
					Order {review.orderId} is no longer in this workspace.
				</p>
			) : null}

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">The shop's answer</h2>
				{review.repliedAt ? (
					<p class="text-xs text-muted-foreground">
						Answered {formatDate(review.repliedAt)}
						{review.repliedBy ? ` by ${review.repliedBy}` : ""}
					</p>
				) : null}
				<textarea
					value={draft}
					onInput={(event) =>
						setDraft((event.target as HTMLTextAreaElement).value)
					}
					rows={4}
					placeholder="An answer travels with the review wherever it is shown."
					class="w-full rounded-lg border border-border bg-card p-2 text-sm"
				/>
				<div>
					<button
						type="button"
						disabled={replyPending || !draft.trim()}
						onClick={() => replyFx({ id: review.id, reply: draft.trim() })}
						class="rounded border border-border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
					>
						{review.reply ? "Update answer" : "Answer"}
					</button>
				</div>
			</section>
		</div>
	);
}

export default ReviewDetailView;
