import { createDomain, type Domain, type EventCallable, type Store } from "effector";
import type { Tier } from "../types";

// Message content lives here once, in `$entries`, keyed by id. Everything else
// — the per-model logs and the conversation the user reads — is an ordered list
// of *references* into this store, never a copy. A host that renders text reads
// the entry through its id; duplicating the text into a view store is what this
// layout exists to prevent.

export const CONVERSATION = "conversation";

export type EntryId = string;
export type EntryStatus = "running" | "completed" | "failed";

export type Attachment = {
	id: string;
	name: string;
	size?: number;
	type?: string;
};

type Common = {
	id: EntryId;
	at: number;
	/** Logs this entry belongs to: the conversation, one per model, both. */
	streams: string[];
	/**
	 * Produced by the host for the screen only — a slash-command answer, a file
	 * bubble the host persists itself. It is part of the timeline but not part of
	 * the record, so whoever dumps the thread must skip it.
	 */
	local?: boolean;
};

export type UserEntry = Common & {
	kind: "user";
	text: string;
	attachment?: Attachment;
};

export type AssistantEntry = Common & {
	kind: "assistant";
	text: string;
	model?: string;
	streaming: boolean;
	tokens?: number;
	finishReason?: string;
};

/** One deciding step of the machine: route/select/args and any custom step. */
export type StepEntry = Common & {
	kind: "step";
	step: string;
	tier: Tier;
	phase: "model" | "apply";
	input?: string;
	status: EntryStatus;
	outcome?: string;
	elapsedMs?: number;
};

/** A function invocation — from the steps or from the model's own tool call. */
export type CallEntry = Common & {
	kind: "call";
	name: string;
	callId?: string;
	args: Record<string, unknown>;
	status: EntryStatus;
	elapsedMs?: number;
	result?: unknown;
	error?: string;
};

export type Entry = UserEntry | AssistantEntry | StepEntry | CallEntry;

export type EntryPatch = Record<string, unknown>;

export type ConversationEntries = {
	domain: Domain;
	$entries: Store<Map<EntryId, Entry>>;
	/** The stitched sequence: refs in the order the conversation happened. */
	$timeline: Store<EntryId[]>;
	/** Per-stream refs — one log per model, plus the conversation itself. */
	$streams: Store<Map<string, EntryId[]>>;
	appended: EventCallable<Entry>;
	patched: EventCallable<{ id: EntryId; patch: EntryPatch }>;
	textAppended: EventCallable<{ id: EntryId; delta: string }>;
	cleared: EventCallable<void>;
	read(id: EntryId): Entry | undefined;
	/** The conversation resolved to entries — what a view renders. */
	list(): Entry[];
	/** One model's log resolved to entries. */
	log(stream: string): Entry[];
};

const withRef = (
	streams: Map<string, EntryId[]>,
	entry: Entry,
): Map<string, EntryId[]> => {
	const next = new Map(streams);
	for (const stream of entry.streams) {
		next.set(stream, [...(next.get(stream) ?? []), entry.id]);
	}
	return next;
};

export function createConversationEntries(
	domain: Domain = createDomain("conversation-entries"),
): ConversationEntries {
	const appended = domain.createEvent<Entry>("ENTRY_APPENDED");
	const patched = domain.createEvent<{ id: EntryId; patch: EntryPatch }>(
		"ENTRY_PATCHED",
	);
	const textAppended = domain.createEvent<{ id: EntryId; delta: string }>(
		"ENTRY_TEXT_APPENDED",
	);
	const cleared = domain.createEvent<void>("ENTRIES_CLEARED");

	const $entries = domain
		.createStore<Map<EntryId, Entry>>(new Map(), { name: "ENTRIES" })
		.on(appended, (entries, entry) => new Map(entries).set(entry.id, entry))
		.on(patched, (entries, { id, patch }) => {
			const current = entries.get(id);
			// A patch for an entry that never arrived is a wiring bug, not a state
			// to invent: dropping it keeps the store honest about what exists.
			if (!current) return entries;
			return new Map(entries).set(id, { ...current, ...patch } as Entry);
		})
		.on(textAppended, (entries, { id, delta }) => {
			const current = entries.get(id);
			if (!current || !("text" in current)) return entries;
			return new Map(entries).set(id, {
				...current,
				text: current.text + delta,
			} as Entry);
		})
		.reset(cleared);

	const $timeline = domain
		.createStore<EntryId[]>([], { name: "TIMELINE" })
		.on(appended, (timeline, entry) =>
			entry.streams.includes(CONVERSATION) ? [...timeline, entry.id] : timeline,
		)
		.reset(cleared);

	const $streams = domain
		.createStore<Map<string, EntryId[]>>(new Map(), { name: "STREAMS" })
		.on(appended, withRef)
		.reset(cleared);

	const resolve = (ids: EntryId[]): Entry[] => {
		const entries = $entries.getState();
		return ids
			.map((id) => entries.get(id))
			.filter((entry): entry is Entry => entry !== undefined);
	};

	return {
		domain,
		$entries,
		$timeline,
		$streams,
		appended,
		patched,
		textAppended,
		cleared,
		read: (id) => $entries.getState().get(id),
		list: () => resolve($timeline.getState()),
		log: (stream) => resolve($streams.getState().get(stream) ?? []),
	};
}
