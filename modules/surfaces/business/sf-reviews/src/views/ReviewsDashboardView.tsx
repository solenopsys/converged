import { useUnit } from "effector-preact";
import {
	BadgeCheck,
	Globe,
	MessageSquare,
	Percent,
	Send,
	StatisticCard,
} from "front-core";
import { objectRef, presentReference } from "front-core/object-runtime";
import type { Review, ReviewInvite } from "g-reviews";
import { useEffect, useMemo } from "preact/compat";
import { inviteStatusConfig, reviewStatusConfig } from "../config";
import { $overview, reviewsViewMounted } from "../domain-reviews";

// The review system at a glance: how the shop is rated, what is waiting for
// somebody, and how far the asking is getting. This is the surface's own
// screen — the one shown when no subtab is pressed — so it answers "what needs
// me today" and leaves "show me the list" to the projections beside it.

function formatDate(value?: string): string {
	if (!value) return "—";
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: date.toLocaleDateString(undefined, {
				day: "2-digit",
				month: "2-digit",
				year: "2-digit",
			});
}

/** The rating as it reads at a glance, without pulling in an icon set. */
function stars(rating: number): string {
	const whole = Math.max(0, Math.min(5, Math.round(rating)));
	return "★".repeat(whole) + "☆".repeat(5 - whole);
}

function QueueRow({ review }: { review: Review }) {
	const open = () =>
		void presentReference(
			objectRef("reviews.review", review.id, {
				title: `${review.author} · ${stars(review.rating)}`,
			}),
		);

	return (
		<button
			type="button"
			onClick={open}
			class="flex w-full flex-col gap-1 border-b border-border py-2 text-left last:border-b-0 transition-colors hover:bg-accent"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="truncate text-sm font-medium">{review.author}</span>
				<span class="shrink-0 text-xs text-amber-600">
					{stars(review.rating)}
				</span>
			</div>
			<div class="line-clamp-2 text-xs text-muted-foreground">
				{review.text}
			</div>
			<div class="flex items-center gap-2 text-[11px] text-muted-foreground">
				<span
					class={`rounded px-1.5 py-0.5 font-medium ${
						reviewStatusConfig[review.status]?.className ?? ""
					}`}
				>
					{reviewStatusConfig[review.status]?.label ?? review.status}
				</span>
				<span class="font-mono">{review.orderId ?? "—"}</span>
				<span>{formatDate(review.createdAt)}</span>
			</div>
		</button>
	);
}

function InviteRow({ invite }: { invite: ReviewInvite }) {
	const config = inviteStatusConfig[invite.status];
	return (
		<div class="flex items-center justify-between gap-3 border-b border-border py-1.5 text-xs last:border-b-0">
			<span class="flex-1 truncate">{invite.contact}</span>
			<span class="truncate font-mono text-muted-foreground">
				{invite.orderId}
			</span>
			<span class="text-muted-foreground">{formatDate(invite.sentAt)}</span>
			<span
				class={`shrink-0 rounded px-1.5 py-0.5 font-medium ${config?.className ?? ""}`}
			>
				{config?.label ?? invite.status}
			</span>
		</div>
	);
}

export function ReviewsDashboardView() {
	const overview = useUnit($overview);

	useEffect(() => {
		reviewsViewMounted();
	}, []);

	const dashboard = overview.dashboard;
	const funnel = dashboard?.funnel;

	// Asked against answered is the number contour 2 lives or dies by; anything
	// else on this screen is a consequence of it.
	const answerRate = useMemo(() => {
		if (!funnel || funnel.sent === 0) return 0;
		return Math.round((funnel.answered / funnel.sent) * 100);
	}, [funnel]);

	const inFlight = useMemo(
		() =>
			overview.invites.filter(
				(invite) => invite.status === "sent" || invite.status === "opened",
			),
		[overview.invites],
	);

	const platforms = overview.settings?.platforms ?? [];

	return (
		<div class="flex flex-col gap-4 p-4">
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
				<StatisticCard
					title="Rating"
					actionKey="reviews.rating"
					value={dashboard?.averageRating ?? 0}
					description={`${dashboard?.total ?? 0} reviews`}
					icon={BadgeCheck}
					loading={overview.loading}
				/>
				<StatisticCard
					title="On moderation"
					actionKey="reviews.pending"
					value={dashboard?.pending ?? 0}
					description={`${dashboard?.awaitingReply ?? 0} unanswered`}
					icon={MessageSquare}
					loading={overview.loading}
				/>
				<StatisticCard
					title="Asked"
					actionKey="reviews.sent"
					value={funnel?.sent ?? 0}
					description={`${funnel?.opened ?? 0} opened`}
					icon={Send}
					loading={overview.loading}
				/>
				<StatisticCard
					title="Answer rate"
					actionKey="reviews.answer-rate"
					value={`${answerRate}%`}
					description={`${funnel?.answered ?? 0} answered`}
					icon={Percent}
					loading={overview.loading}
				/>
				<StatisticCard
					title="Shared publicly"
					actionKey="reviews.external"
					value={`${Math.round(dashboard?.externalSharePercent ?? 0)}%`}
					description={
						platforms.length > 0
							? `${platforms.length} platforms`
							: "No platforms set up"
					}
					icon={Globe}
					loading={overview.loading}
				/>
			</div>

			{overview.error ? (
				<div class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
					{overview.error}
				</div>
			) : null}

			{platforms.length === 0 ? (
				<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
					No external platforms are configured, so the public form has nowhere
					to send a happy customer. Add them in the shop's review settings.
				</div>
			) : null}

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">Waiting for moderation</h2>
				{overview.queue.length === 0 ? (
					<p class="text-sm text-muted-foreground">
						{overview.loading ? "Loading…" : "Nothing is waiting."}
					</p>
				) : (
					<div class="rounded-lg border border-border bg-card px-3">
						{overview.queue.slice(0, 10).map((review) => (
							<QueueRow key={review.id} review={review} />
						))}
					</div>
				)}
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">Asked, still quiet</h2>
				{inFlight.length === 0 ? (
					<p class="text-sm text-muted-foreground">Nothing in flight.</p>
				) : (
					<div class="rounded-lg border border-border bg-card px-3 py-1">
						{inFlight.slice(0, 8).map((invite) => (
							<InviteRow key={invite.id} invite={invite} />
						))}
					</div>
				)}
			</section>
		</div>
	);
}

export default ReviewsDashboardView;
