import { useUnit } from "effector-preact";
import {
	AlertCircle,
	ClipboardList,
	StatisticCard,
	Target,
	useSurfaceTranslation,
} from "front-core";
import { objectRef, presentReference } from "front-core/object-runtime";
import type { Ticket } from "g-support";
import { useEffect, useMemo } from "preact/compat";
import { STATUS_CLASSES, SURFACE_ID } from "../config";
import { $support, supportViewMounted } from "../domain-support";

// Support at a glance: what I asked for, what the club wants most, and — for
// the 4IR team — what is waiting. The surface's own screen, so it answers
// "where does this stand" and leaves the full lists to the tabs beside it.

type Translate = (key: string) => unknown;

const text = (t: Translate, key: string): string => String(t(key));

function TicketRow({ ticket, t }: { ticket: Ticket; t: Translate }) {
	const open = () =>
		void presentReference(
			objectRef("support.ticket", ticket.id, {
				title: `#${ticket.number} ${ticket.title}`,
			}),
		);

	return (
		<button
			type="button"
			onClick={open}
			class="flex w-full items-center justify-between gap-3 border-b border-border py-1.5 text-left text-xs last:border-b-0 hover:bg-accent"
		>
			<span class="shrink-0 text-muted-foreground">#{ticket.number}</span>
			<span class="flex-1 truncate">{ticket.title}</span>
			<span
				class={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[ticket.status] ?? ""}`}
			>
				{text(t, `status.${ticket.status}`)}
			</span>
			{ticket.type === "feature" ? (
				<span class="w-8 shrink-0 text-right tabular-nums">{ticket.votes}</span>
			) : null}
		</button>
	);
}

export function SupportOverviewView() {
	const state = useUnit($support);
	const { t } = useSurfaceTranslation(SURFACE_ID);

	useEffect(() => {
		supportViewMounted();
	}, []);

	// The rating is what the club is asking for, loudest first. `rp-support`
	// already sorted it by votes; re-sorting here would be a second opinion
	// about an order the server owns.
	const topFeatures = useMemo(
		() => state.features.slice(0, 8),
		[state.features],
	);
	const openMine = useMemo(
		() => state.mine.filter((ticket) => ticket.status === "open"),
		[state.mine],
	);
	const planned = useMemo(
		() => state.features.filter((ticket) => ticket.status === "planned").length,
		[state.features],
	);

	return (
		<div class="flex flex-col gap-4 p-4">
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatisticCard
					title={text(t, "stats.mine")}
					actionKey="support.mine"
					value={state.mine.length}
					description={text(t, "stats.mineOpen").replace(
						"{count}",
						String(openMine.length),
					)}
					icon={ClipboardList}
					loading={state.loading}
				/>
				<StatisticCard
					title={text(t, "stats.features")}
					actionKey="support.features"
					value={state.features.length}
					icon={Target}
					loading={state.loading}
				/>
				<StatisticCard
					title={text(t, "stats.planned")}
					actionKey="support.planned"
					value={planned}
					description={text(t, "stats.plannedHint")}
					icon={Target}
					loading={state.loading}
				/>
				{/* The queue is a team number. For everybody else `rp-support`
				    narrows the same question to their own bugs, which is a
				    different thing and would be a misleading card. */}
				{state.isTeam ? (
					<StatisticCard
						title={text(t, "stats.queue")}
						actionKey="support.queue"
						value={state.queue.length}
						icon={AlertCircle}
						loading={state.loading}
					/>
				) : null}
			</div>

			{state.error ? (
				<div class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
					{state.error}
				</div>
			) : null}

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">{text(t, "overview.rating")}</h2>
				{topFeatures.length === 0 ? (
					<p class="text-sm text-muted-foreground">
						{text(
							t,
							state.loading ? "overview.loading" : "overview.noFeatures",
						)}
					</p>
				) : (
					<div class="rounded-lg border border-border bg-card px-3 py-1">
						{topFeatures.map((ticket) => (
							<TicketRow key={ticket.id} ticket={ticket} t={t} />
						))}
					</div>
				)}
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold">{text(t, "overview.mine")}</h2>
				{state.mine.length === 0 ? (
					<p class="text-sm text-muted-foreground">
						{text(t, state.loading ? "overview.loading" : "overview.noneMine")}
					</p>
				) : (
					<div class="rounded-lg border border-border bg-card px-3 py-1">
						{state.mine.slice(0, 8).map((ticket) => (
							<TicketRow key={ticket.id} ticket={ticket} t={t} />
						))}
					</div>
				)}
			</section>

			{state.isTeam ? (
				<section class="flex flex-col gap-2">
					<h2 class="text-sm font-semibold">{text(t, "overview.queue")}</h2>
					{state.queue.length === 0 ? (
						<p class="text-sm text-muted-foreground">
							{text(t, "overview.queueEmpty")}
						</p>
					) : (
						<div class="rounded-lg border border-border bg-card px-3 py-1">
							{state.queue.slice(0, 10).map((ticket) => (
								<TicketRow key={ticket.id} ticket={ticket} t={t} />
							))}
						</div>
					)}
				</section>
			) : null}
		</div>
	);
}
