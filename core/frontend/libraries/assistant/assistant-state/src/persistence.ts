import type { Conversation } from "orchestrator";
import { MessageType, type ChatMetadataService, type ThreadsService } from "./types";

// Dumping the conversation to the backend. The thread is the durable record;
// the stores are what the turn is doing right now. This listens to the stores
// and writes each settled entry through once — it never holds a copy of them.

export type ChatPersistenceOptions = {
	conversation: Conversation;
	threadsService: ThreadsService;
	metadataService?: ChatMetadataService;
	threadId: () => string;
};

export function bindChatPersistence({
	conversation,
	threadsService,
	metadataService,
	threadId,
}: ChatPersistenceOptions): void {
	const written = new Set<string>();

	const record = async (data: string): Promise<void> => {
		const thread = threadId();
		if (!thread) return;
		try {
			await threadsService.saveMessage({
				threadId: thread,
				user: data.startsWith("[user]") ? "user" : "assistant",
				type: MessageType.message,
				data: data.replace(/^\[user\]\s?/, ""),
				timestamp: Date.now(),
			});
			await metadataService?.recordChatMessage(thread);
		} catch (error) {
			console.warn("[assistant-state] Failed to persist a message", error);
		}
	};

	// The user's line is durable the moment it is said; everything else is
	// written when it settles, so a half-streamed answer never reaches the thread.
	conversation.entries.appended.watch((entry) => {
		if (entry.local || entry.kind !== "user" || written.has(entry.id)) return;
		written.add(entry.id);
		void record(`[user] ${entry.text}`);
	});

	conversation.entries.patched.watch(({ id }) => {
		const entry = conversation.entries.read(id);
		if (!entry || entry.local || written.has(id)) return;

		if (entry.kind === "assistant" && !entry.streaming) {
			if (!entry.text.trim()) return;
			written.add(id);
			void record(entry.text);
			return;
		}

		if (entry.kind === "call" && entry.status !== "running") {
			written.add(id);
			const outcome =
				entry.status === "failed"
					? { error: entry.error }
					: { result: entry.result };
			void record(
				`Tool call ${entry.callId ?? entry.name} result:\n${JSON.stringify(outcome, null, 2)}`,
			);
		}
	});
}
