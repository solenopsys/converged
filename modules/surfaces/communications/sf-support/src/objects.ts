import { authToken, EntityListView } from "front-core";
import {
	Category,
	defineSurface,
	type ObjectDefinition,
	objectOf,
	objectRef,
	setOf,
	setRef,
} from "front-core/object-runtime";
import type { TicketListParams, TicketStatus, TicketType } from "g-support";
import { MessageType } from "g-threads";
import {
	ratingColumns,
	TICKET_STATUSES,
	TICKET_TYPES,
	ticketColumns,
	tr,
} from "./config";
import { similarTickets, ticketChanged, ticketCreated } from "./domain-support";
import { mintThreadId, supportClient, threadsClient } from "./services";
import { SupportSummary } from "./summary";
import { SupportOverviewView } from "./views/SupportOverviewView";
import { TicketDetailView } from "./views/TicketDetailView";

// Support as one working area.
//
// Three `setOf` views — my tickets, the feature rating, the team's queue — and
// one `objectOf` view for a ticket, which opens as a closable button inside the
// same tab. With nothing pressed the surface shows its own screen.
//
// What shapes this file: **there is one entity here and it is a ticket.** No
// categories, no SLA, no assignment, no internal notes, no attachment table and
// no event table. A file is a message in the thread and a status change is a
// message in the thread, so anything that looks like it wants its own table
// here is almost certainly a message.

const TYPE_OPTIONS = () =>
	TICKET_TYPES.map((type) => ({ value: type, label: tr(`type.${type}`) }));

const STATUS_OPTIONS = () =>
	TICKET_STATUSES.map((status) => ({
		value: status,
		label: tr(`status.${status}`),
	}));

function ticketIdOf(references: readonly { kind: string }[]): string {
	const ref = references.find(
		(item: any) => item.kind === "object" && item.type === "support.ticket",
	) as { kind: string; id?: string } | undefined;
	if (ref?.kind !== "object" || !ref.id)
		throw new Error("A ticket reference is required");
	return ref.id;
}

/**
 * Mint the thread, register it, file the ticket, write the description.
 *
 * In that order, and not fewer calls. `rp-support` cannot open a thread —
 * repositories do not call each other — so the client that wants both makes
 * both. A crash between the thread and the ticket leaves an orphan thread,
 * which costs a row; the other order would leave a ticket nobody can open.
 */
async function openTicket(input: {
	type: TicketType;
	title: string;
	body?: string;
	author: string;
}) {
	const threadId = mintThreadId();
	// A bug is its author's and the team's; a feature is everybody's. The tags
	// on the ticket and on its thread are kept in step here, by the caller that
	// created both, because the two repositories share no tag table.
	await threadsClient.registerThread(threadId, "comment", {
		visibility: input.type === "feature" ? "authenticated" : "private",
	} as never);

	const ticket = await supportClient.createTicket({
		type: input.type,
		title: input.title,
		threadId,
	});

	const body = input.body?.trim();
	if (body) {
		await threadsClient.saveMessage({
			threadId,
			user: input.author,
			type: MessageType.message,
			data: body,
			timestamp: Date.now(),
		});
	}
	return ticket;
}

export const objects = [
	{
		id: "support.ticket",
		label: "Ticket",
		labelKey: "types.ticket.label",
		pluralLabel: "My tickets",
		pluralLabelKey: "menu.mine",
		description:
			"Something broken or something missing, with a number, a type and the whole conversation about it",
		descriptionKey: "types.ticket.description",
		categories: [Category.Business, Category.Selectable, Category.Creatable],
		selection: {
			filters: [
				{
					id: "type",
					label: tr("columns.type"),
					valueType: "string",
					operators: ["eq"],
					control: "select",
					options: TYPE_OPTIONS().map((option) => ({
						id: option.value,
						label: option.label,
					})),
				},
			],
			load: (params) =>
				supportClient.listTickets({
					...(params as TicketListParams),
					mine: true,
				}),
		},
		infinity: {
			tableId: "support-mine",
			title: tr("menu.mine"),
			columns: ticketColumns(),
			load: (params) =>
				supportClient.listTickets({
					...(params as TicketListParams),
					mine: true,
				}),
			rowRef: (row) => {
				const ticket = row as {
					id?: unknown;
					number?: unknown;
					title?: unknown;
				};
				return objectRef("support.ticket", String(ticket.id ?? ""), {
					title: `#${ticket.number ?? "?"} ${ticket.title ?? ""}`.trim(),
				});
			},
			filters: [
				{
					id: "query",
					label: tr("columns.search"),
					type: "search",
					operator: "contains",
				},
				{
					id: "type",
					label: tr("columns.type"),
					type: "select",
					operator: "eq",
					options: TYPE_OPTIONS(),
				},
				{
					id: "status",
					label: tr("columns.status"),
					type: "select",
					operator: "eq",
					options: STATUS_OPTIONS(),
				},
			],
			// What is still being waited on comes first; what is finished is a
			// different question and stays one click away.
			presets: [
				{
					id: "support.mine.open",
					label: tr("tabs.open"),
					control: "tab",
					group: "support-mine",
					defaults: { status: "open" },
				},
				{
					id: "support.mine.all",
					label: tr("tabs.all"),
					control: "tab",
					group: "support-mine",
				},
			],
			mobile: { title: "title", subtitle: "status", badge: "type" },
		},
	},
	{
		id: "support.feature",
		label: "Feature",
		labelKey: "types.feature.label",
		pluralLabel: "Features",
		pluralLabelKey: "menu.features",
		description:
			"What the club is asking for, ordered by how many members want it",
		descriptionKey: "types.feature.description",
		categories: [Category.Business, Category.Selectable],
		selection: {
			filters: [],
			load: (params) =>
				supportClient.listTickets({
					...(params as TicketListParams),
					type: "feature",
					sort: "votes",
				}),
		},
		infinity: {
			tableId: "support-features",
			title: tr("menu.features"),
			columns: ratingColumns(),
			load: (params) =>
				supportClient.listTickets({
					...(params as TicketListParams),
					type: "feature",
					sort: "votes",
				}),
			rowRef: (row) => {
				const ticket = row as {
					id?: unknown;
					number?: unknown;
					title?: unknown;
				};
				return objectRef("support.ticket", String(ticket.id ?? ""), {
					title: `#${ticket.number ?? "?"} ${ticket.title ?? ""}`.trim(),
				});
			},
			filters: [
				{
					id: "query",
					label: tr("columns.search"),
					type: "search",
					operator: "contains",
				},
				{
					id: "status",
					label: tr("columns.status"),
					type: "select",
					operator: "eq",
					options: STATUS_OPTIONS(),
				},
			],
			presets: [
				{
					id: "support.feature.all",
					label: tr("tabs.all"),
					control: "tab",
					group: "support-features",
				},
				{
					id: "support.feature.planned",
					label: tr("tabs.planned"),
					control: "tab",
					group: "support-features",
					defaults: { status: "planned" },
				},
			],
			mobile: { title: "title", subtitle: "status", badge: "votes" },
		},
	},
	{
		id: "support.queue",
		label: "Queue item",
		labelKey: "types.queue.label",
		pluralLabel: "Queue",
		pluralLabelKey: "menu.queue",
		description:
			"Open bugs. The 4IR team sees every one; anybody else sees their own",
		descriptionKey: "types.queue.description",
		categories: [Category.Business, Category.Selectable],
		selection: {
			filters: [],
			load: (params) =>
				supportClient.listTickets({
					...(params as TicketListParams),
					type: "bug",
				}),
		},
		infinity: {
			tableId: "support-queue",
			title: tr("menu.queue"),
			columns: ticketColumns(),
			load: (params) =>
				supportClient.listTickets({
					...(params as TicketListParams),
					type: "bug",
				}),
			rowRef: (row) => {
				const ticket = row as {
					id?: unknown;
					number?: unknown;
					title?: unknown;
				};
				return objectRef("support.ticket", String(ticket.id ?? ""), {
					title: `#${ticket.number ?? "?"} ${ticket.title ?? ""}`.trim(),
				});
			},
			filters: [
				{
					id: "status",
					label: tr("columns.status"),
					type: "select",
					operator: "eq",
					options: STATUS_OPTIONS(),
				},
			],
			presets: [
				{
					id: "support.queue.open",
					label: tr("tabs.open"),
					control: "tab",
					group: "support-queue",
					defaults: { status: "open" },
				},
				{
					id: "support.queue.all",
					label: tr("tabs.all"),
					control: "tab",
					group: "support-queue",
				},
			],
		},
	},
	{
		id: "support.statistic.summary",
		label: "Support",
		labelKey: "menu.support",
		categories: [Category.Statistic, Category.Business],
		statistic: { role: "summary", component: SupportSummary },
	},
	{
		id: "support.statistic",
		label: "Overview",
		labelKey: "menu.overview",
		pluralLabel: "Overview",
		pluralLabelKey: "menu.overview",
		categories: [Category.Statistic, Category.Business],
	},
] satisfies readonly ObjectDefinition[];

export default defineSurface({
	id: "sf-support",
	label: "Support",
	labelKey: "surface.label",
	purpose:
		"Report something broken, ask for something missing, and vote on what the club should build next",
	types: objects,
	views: [
		{
			id: "support.ticket.detail",
			accepts: objectOf("support.ticket"),
			component: TicketDetailView,
			props: (ref) => ({
				ticketId: ref.kind === "object" ? ref.id : undefined,
			}),
		},
		{
			id: "support.ticket.table",
			label: "My tickets",
			accepts: setOf("support.ticket"),
			component: EntityListView,
		},
		{
			id: "support.feature.table",
			label: "Features",
			accepts: setOf("support.feature"),
			component: EntityListView,
		},
		{
			id: "support.queue.table",
			label: "Queue",
			accepts: setOf("support.queue"),
			component: EntityListView,
		},
		{
			id: "support.statistic.dashboard",
			label: "Overview",
			accepts: setOf("support.statistic"),
			component: SupportOverviewView,
		},
	],
	operations: [
		{
			// The one this surface exists for, and the one the assistant drives.
			//
			// Deduplication happens before this call, not inside it: `findSimilar`
			// below is what the assistant asks first, and a member who is shown an
			// existing feature and likes it never gets here. The schema stays
			// simple because the judgement lives in the conversation.
			id: "support.ticket.create",
			operator: "create",
			target: "support.ticket",
			label: "Open a ticket",
			labelKey: "operations.create.label",
			description:
				"Report something broken or ask for something missing. Describe it in your own words; the description becomes the first message in the ticket's thread.",
			descriptionKey: "operations.create.description",
			output: objectOf("support.ticket"),
			parameters: {
				type: "object",
				properties: {
					type: { type: "string", enum: [...TICKET_TYPES] },
					title: { type: "string", description: "One line, as people say it" },
					body: {
						type: "string",
						description: "The full description — becomes the first message",
					},
				},
				required: ["type", "title"],
			},
			presentOutput: true,
			invoke: async ({ params }) => {
				const title = String(params.title ?? "").trim();
				if (!title) throw new Error(tr("errors.titleRequired"));
				const ticket = await openTicket({
					type: String(params.type) as TicketType,
					title,
					body: params.body ? String(params.body) : undefined,
					// Only for rendering "you" on the opening message; the server
					// stamps the real author on the ticket from the token.
					author: authToken.payload()?.sub ?? "me",
				});
				ticketCreated(ticket);
				return objectRef("support.ticket", ticket.id, {
					title: `#${ticket.number} ${ticket.title}`,
				});
			},
		},
		{
			// What the assistant calls before creating anything.
			//
			// It answers with the set, not with a sentence, so the member sees the
			// near-misses and can like one instead of filing a duplicate. Searching
			// only features is the point: two people reporting the same bug is
			// useful, two people asking for the same feature splits a rating.
			id: "support.ticket.findSimilar",
			operator: "show",
			target: "support.feature",
			label: "Find a feature like this",
			labelKey: "operations.findSimilar.label",
			description:
				"Look for features that already ask for this. Use before opening a feature ticket: if one comes back, offer to like it instead of filing a duplicate.",
			descriptionKey: "operations.findSimilar.description",
			output: setOf("support.feature"),
			parameters: {
				type: "object",
				properties: {
					title: { type: "string", description: "The wish, in one line" },
				},
				required: ["title"],
			},
			presentOutput: true,
			invoke: async ({ params }) => {
				const title = String(params.title ?? "").trim();
				// The server's `query` is a title match; the word overlap on top of
				// it catches the rest. Asking for the broad set and narrowing here
				// is cheaper than a second round trip per candidate.
				const listed = await supportClient.listTickets({
					offset: 0,
					limit: 200,
					type: "feature",
					sort: "votes",
				});
				const matches = similarTickets(title, listed.items ?? []);
				return setRef(
					"support.feature",
					{ kind: "ids", ids: matches.map((ticket) => ticket.id) },
					{ title: tr("operations.findSimilar.done") },
				);
			},
		},
		{
			id: "support.ticket.vote",
			operator: "execute",
			target: "support.ticket",
			label: "Like",
			labelKey: "operations.vote.label",
			description:
				"Add your like to a feature. One person, one like — liking twice changes nothing.",
			descriptionKey: "operations.vote.description",
			inputs: [{ name: "ticket", accepts: objectOf("support.ticket") }],
			invoke: async ({ references }) => {
				const id = ticketIdOf(references);
				const votes = await supportClient.vote(id);
				const ticket = await supportClient.getTicket(id);
				if (ticket) ticketChanged({ ...ticket, votes });
				return votes;
			},
		},
		{
			id: "support.ticket.unvote",
			operator: "execute",
			target: "support.ticket",
			label: "Take back a like",
			labelKey: "operations.unvote.label",
			description: "Remove your like from a feature.",
			descriptionKey: "operations.unvote.description",
			inputs: [{ name: "ticket", accepts: objectOf("support.ticket") }],
			invoke: async ({ references }) => {
				const id = ticketIdOf(references);
				const votes = await supportClient.unvote(id);
				const ticket = await supportClient.getTicket(id);
				if (ticket) ticketChanged({ ...ticket, votes });
				return votes;
			},
		},
		{
			// The 4IR team only. `rp-support` enforces that; this is the screen for
			// it, and it is deliberately the same six statuses with no "priority"
			// beside them — taking a feature on is the status `planned`.
			id: "support.ticket.setStatus",
			operator: "execute",
			target: "support.ticket",
			label: "Set status",
			labelKey: "operations.setStatus.label",
			description:
				"Move a ticket along. The 4IR team only — everybody else is refused by the service.",
			descriptionKey: "operations.setStatus.description",
			inputs: [{ name: "ticket", accepts: objectOf("support.ticket") }],
			parameters: {
				type: "object",
				properties: {
					status: { type: "string", enum: [...TICKET_STATUSES] },
				},
				required: ["status"],
			},
			invoke: async ({ references, params }) => {
				const id = ticketIdOf(references);
				const ticket = await supportClient.setStatus(
					id,
					String(params.status) as TicketStatus,
				);
				ticketChanged(ticket);
				return ticket;
			},
		},
	],
});
