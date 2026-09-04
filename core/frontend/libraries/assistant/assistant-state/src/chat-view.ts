import { combine, type Store } from "effector";
import type { Conversation, Entry } from "orchestrator";
import type { ChatMessage } from "./types";

// The screen's shape, derived from the conversation stores — not a second copy
// of them. Text lives once, in the orchestrator's entries; this maps the
// referenced entries into what the components already render, and recomputes
// whenever the referenced entry changes.

export type ChatView = {
	messages: ChatMessage[];
	/** The answer still streaming, rendered apart from the settled messages. */
	currentResponse: string;
	isLoading: boolean;
	lastToolCallName?: string;
	/** Current planner stage, shown as operational progress rather than reasoning. */
	activeStep?: string;
};

export type ChatViewOptions = {
	conversation: Conversation;
	/** Human label for a function id; the catalog knows ids, not wording. */
	label?: (id: string) => string | undefined;
};

const summarize = (args: Record<string, unknown>): string | undefined =>
	Object.entries(args)
		.filter(
			([, value]) => value !== undefined && value !== null && value !== "",
		)
		.slice(0, 4)
		.map(([key, value]) => {
			const raw = typeof value === "string" ? value : JSON.stringify(value);
			return `${key}: ${raw.length > 40 ? `${raw.slice(0, 40)}…` : raw}`;
		})
		.join(", ") || undefined;

function toMessage(
	entry: Entry,
	label?: (id: string) => string | undefined,
): ChatMessage | undefined {
	switch (entry.kind) {
		case "user":
			return {
				id: entry.id,
				type: "user",
				content: entry.text,
				timestamp: entry.at,
				fileData: entry.attachment
					? {
							fileId: entry.attachment.id,
							fileName: entry.attachment.name,
							fileSize: entry.attachment.size,
							fileType: entry.attachment.type,
						}
					: undefined,
			};
		case "assistant":
			return {
				id: entry.id,
				type: "assistant",
				content: entry.text,
				timestamp: entry.at,
			};
		case "call":
			return {
				id: entry.id,
				type: "assistant",
				content: entry.name,
				timestamp: entry.at,
				toolCallData: {
					toolCallId: entry.callId,
					title: label?.(entry.name) ?? entry.name,
					status: entry.status,
					summary: summarize(entry.args),
					details:
						entry.status === "failed"
							? { args: entry.args, error: entry.error }
							: { args: entry.args, result: entry.result },
					// The trail is the catalog and the choice made in it, never a
					// prompt or a step outcome — see `CallEntry.trail`.
					...(entry.trail?.length ? { steps: entry.trail } : {}),
				},
			};
		// Steps stay in the model's own log: they are the machine reasoning, not
		// something the user reads. What *is* readable — which function was picked
		// out of which alternatives — rides on the call entry as `trail`.
		default:
			return undefined;
	}
}

export function createChatView({
	conversation,
	label,
}: ChatViewOptions): Store<ChatView> {
	const { entries, turn } = conversation;

	return combine(
		entries.$timeline,
		entries.$entries,
		turn.$running,
		(timeline, byId, running): ChatView => {
			const visible = timeline
				.map((id) => byId.get(id))
				.filter((entry): entry is Entry => entry !== undefined);

			const streaming = visible.find(
				(entry) => entry.kind === "assistant" && entry.streaming,
			);
			const running_ = visible.filter(
				(entry) => entry.kind === "call" && entry.status === "running",
			);
			const activeStep = visible
				.filter((entry) => entry.kind === "step" && entry.status === "running")
				.at(-1);

			return {
				messages: visible
					.filter((entry) => entry !== streaming)
					.map((entry) => toMessage(entry, label))
					.filter((message): message is ChatMessage => message !== undefined),
				currentResponse:
					streaming && streaming.kind === "assistant" ? streaming.text : "",
				isLoading: running,
				lastToolCallName:
					running_.at(-1)?.kind === "call"
						? (running_.at(-1) as { name: string }).name
						: undefined,
				activeStep: activeStep?.kind === "step" ? activeStep.step : undefined,
			};
		},
	);
}
