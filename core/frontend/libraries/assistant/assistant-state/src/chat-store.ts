import type { Store } from "effector";
import {
	CONVERSATION,
	type Conversation,
	type ExecutableTool,
} from "orchestrator";
import { type ChatView, createChatView } from "./chat-view";
import { bindChatPersistence } from "./persistence";
import type { ChatMessage, ChatMetadataService, ThreadsService } from "./types";

// What is left of the chat "store" once the turn belongs to the orchestrator:
// a view over its entries, a dump of them into the thread, and the handful of
// things a screen needs to call. No message list, no streaming buffer, no round
// counters — those exist once, in the conversation.

export type ChatStoreOptions = {
	conversation: Conversation;
	threadsService: ThreadsService;
	metadataService?: ChatMetadataService;
	threadId: string;
	label?: (id: string) => string | undefined;
};

export type ChatStore = {
	/** The screen's state, derived from the conversation. */
	$chat: Store<ChatView>;
	$functions: Store<Map<string, ExecutableTool>>;
	conversation: Conversation;
	threadId: string;
	send(text: string): void;
	registerFunction(name: string, tool: ExecutableTool): void;
	invokeFunction(name: string, args: Record<string, unknown>): Promise<unknown>;
	/**
	 * Hand the model something the application did on its own — an upload that
	 * finished processing, a job that reported back — and let it decide what
	 * follows. No user message is written: the event is not the user's line.
	 */
	follow(event: string): Promise<void>;
	/**
	 * A line produced by the host itself — a slash-command answer, a notice.
	 * It goes into the same timeline so the screen has one source, but it never
	 * reaches the model.
	 */
	addLocalMessage(content: string, type?: ChatMessage["type"]): void;
	attach(file: {
		id: string;
		name: string;
		size?: number;
		type?: string;
	}): void;
	/**
	 * Files the application learned about by itself — the contents of an archive
	 * once it was unpacked, say. They join the model's file context exactly like
	 * an upload, but nothing is drawn on the screen: the user attached one
	 * archive, not the thirteen files inside it. `replaces` drops the entries
	 * these stand in for, so the archive does not travel next to its own
	 * contents.
	 */
	noteFiles(
		files: Array<{ id: string; name: string; size?: number; type?: string }>,
		replaces?: string[],
	): void;
	readonly messages: ChatMessage[];
	readonly isLoading: boolean;
	readonly currentResponse: string;
};

type PendingAttachment = {
	id: string;
	name: string;
	size?: number;
	type?: string;
};

function fileContext(files: PendingAttachment[]): string {
	return files
		.map((file) => {
			const size = file.size === undefined ? "" : ` size=${file.size}`;
			const type = file.type ? ` type=${JSON.stringify(file.type)}` : "";
			return `[FILE] id=${file.id} name=${JSON.stringify(file.name)}${size}${type}`;
		})
		.join("\n");
}

export const createChatStore = ({
	conversation,
	threadsService,
	metadataService,
	threadId,
	label,
}: ChatStoreOptions): ChatStore => {
	const $chat = createChatView({ conversation, label });
	const pendingAttachments: PendingAttachment[] = [];

	bindChatPersistence({
		conversation,
		threadsService,
		metadataService,
		threadId: () => threadId,
	});

	return {
		$chat,
		$functions: conversation.$tools,
		conversation,
		threadId,

		send: (text) => {
			const content = text.trim();
			if (!content) return;
			const attachments = pendingAttachments.splice(0);
			const input = attachments.length
				? `${fileContext(attachments)}\n\n${content}`
				: content;
			void conversation.send(input);
		},

		registerFunction: (name, tool) =>
			conversation.registerTool({ ...tool, name }),

		invokeFunction: (name, args) => conversation.invokeTool(name, args),

		follow: (event) => conversation.follow(event),

		addLocalMessage: (content, type = "assistant") =>
			conversation.entries.appended(
				type === "user"
					? {
							id: `local-${crypto.randomUUID()}`,
							at: Date.now(),
							streams: [CONVERSATION],
							local: true,
							kind: "user",
							text: content,
						}
					: {
							id: `local-${crypto.randomUUID()}`,
							at: Date.now(),
							streams: [CONVERSATION],
							local: true,
							kind: "assistant",
							text: content,
							streaming: false,
						},
			),

		// The file itself is written to the thread as a link by the uploads
		// binding, so this entry is for the screen only.
		attach: (file) => {
			pendingAttachments.push(file);
			conversation.entries.appended({
				id: `file-${file.id}`,
				at: Date.now(),
				streams: [CONVERSATION],
				local: true,
				kind: "user",
				text: file.name,
				attachment: {
					id: file.id,
					name: file.name,
					size: file.size,
					type: file.type,
				},
			});
		},

		noteFiles: (files, replaces = []) => {
			for (const id of replaces) {
				const index = pendingAttachments.findIndex((file) => file.id === id);
				if (index >= 0) pendingAttachments.splice(index, 1);
			}
			for (const file of files) {
				if (pendingAttachments.some((known) => known.id === file.id)) continue;
				pendingAttachments.push(file);
			}
		},

		get messages() {
			return $chat.getState().messages;
		},
		get isLoading() {
			return $chat.getState().isLoading;
		},
		get currentResponse() {
			return $chat.getState().currentResponse;
		},
	};
};
