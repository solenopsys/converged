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
	readonly messages: ChatMessage[];
	readonly isLoading: boolean;
	readonly currentResponse: string;
};

export const createChatStore = ({
	conversation,
	threadsService,
	metadataService,
	threadId,
	label,
}: ChatStoreOptions): ChatStore => {
	const $chat = createChatView({ conversation, label });

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

		// What the visitor typed, and nothing else. Files reach the model as
		// attachments and through getUploadedChatFiles; pasting their ids into
		// the message turned the chat into a wall of identifiers.
		send: (text) => {
			const content = text.trim();
			if (!content) return;
			void conversation.send(content);
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
