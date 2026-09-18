import { createDomain, sample } from "effector";
import type { Ticket } from "g-support";
import { supportClient } from "./services";

const domain = createDomain("sf-support");

export const supportViewMounted = domain.createEvent("SUPPORT_VIEW_MOUNTED");
export const refreshClicked = domain.createEvent("SUPPORT_REFRESH_CLICKED");
export const ticketChanged = domain.createEvent<Ticket>(
	"SUPPORT_TICKET_CHANGED",
);
export const ticketCreated = domain.createEvent<Ticket>(
	"SUPPORT_TICKET_CREATED",
);

export type SupportState = {
	mine: Ticket[];
	features: Ticket[];
	queue: Ticket[];
	/** The team's queue came back — which is how this surface learns the caller
	 *  is on the team, since there is no "am I team" question to ask. */
	isTeam: boolean;
	loading: boolean;
	error?: string;
};

const EMPTY: SupportState = {
	mine: [],
	features: [],
	queue: [],
	isTeam: false,
	loading: false,
};

/**
 * Three listings, and the third one is allowed to fail.
 *
 * "My tickets" and the feature rating are everybody's. The queue — every open
 * bug — comes back only for the 4IR team, and for anybody else `rp-support`
 * narrows it to their own bugs rather than refusing. So the queue is asked for
 * unconditionally and its emptiness is not evidence of anything; what marks a
 * team member is `isTeam`, which is set when the queue returns bugs the caller
 * did not write.
 *
 * That inference is deliberate and it is one-way: it can only ever fail closed.
 * A team member with no foreign bugs in the queue sees the member's screen,
 * which is the harmless direction — the alternative would be showing status
 * controls to somebody the server will refuse.
 */
export const loadSupportFx = domain.createEffect({
	name: "LOAD_SUPPORT",
	handler: async (): Promise<Omit<SupportState, "loading" | "error">> => {
		const [mineList, featureList] = await Promise.all([
			supportClient.listTickets({ offset: 0, limit: 200, mine: true }),
			supportClient.listTickets({
				offset: 0,
				limit: 200,
				type: "feature",
				sort: "votes",
			}),
		]);
		const mine = mineList.items ?? [];
		const features = featureList.items ?? [];

		let queue: Ticket[] = [];
		try {
			const listed = await supportClient.listTickets({
				offset: 0,
				limit: 200,
				type: "bug",
				status: "open",
			});
			queue = listed.items ?? [];
		} catch {
			queue = [];
		}

		const ownIds = new Set(mine.map((ticket) => ticket.id));
		const isTeam = queue.some((ticket) => !ownIds.has(ticket.id));

		return { mine, features, queue, isTeam };
	},
});

export const $support = domain
	.createStore<SupportState>(EMPTY, { name: "SUPPORT" })
	.on(loadSupportFx, (state) => ({ ...state, loading: true, error: undefined }))
	.on(loadSupportFx.doneData, (state, loaded) => ({
		...state,
		...loaded,
		loading: false,
	}))
	.on(loadSupportFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: error.message,
	}))
	// A vote or a status change touches one row in up to three lists. Patching
	// all of them keeps the screen consistent without a reload; a row that is
	// not in a list stays out of it, because appending it here would put a
	// ticket in a projection it does not belong to.
	.on(ticketChanged, (state, ticket) => {
		const patch = (list: Ticket[]) =>
			list.map((item) => (item.id === ticket.id ? ticket : item));
		return {
			...state,
			mine: patch(state.mine),
			features: patch(state.features),
			queue: patch(state.queue),
		};
	})
	.on(ticketCreated, (state, ticket) => ({
		...state,
		mine: [ticket, ...state.mine],
		features:
			ticket.type === "feature" ? [...state.features, ticket] : state.features,
	}));

sample({
	clock: [supportViewMounted, refreshClicked],
	target: loadSupportFx,
});

/**
 * Titles that look like this one, best first.
 *
 * This is the client half of "propose a like instead of a duplicate": the
 * assistant asks the server with `query`, but a person typing a title wants to
 * see the near-misses before they press anything. Word overlap, not edit
 * distance — "экспорт в CSV" and "CSV export" share nothing character-wise and
 * everything in meaning, and a word match at least catches one of those.
 */
export function similarTickets(
	title: string,
	candidates: readonly Ticket[],
	limit = 5,
): Ticket[] {
	const words = title
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word.length > 2);
	if (words.length === 0) return [];
	return candidates
		.map((ticket) => {
			const haystack = ticket.title.toLowerCase();
			return {
				ticket,
				score: words.filter((word) => haystack.includes(word)).length,
			};
		})
		.filter(({ score }) => score > 0)
		.sort(
			(left, right) =>
				right.score - left.score || right.ticket.votes - left.ticket.votes,
		)
		.slice(0, limit)
		.map(({ ticket }) => ticket);
}
