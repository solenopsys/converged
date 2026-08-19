import type { ChatStore } from "./chat-store";

// Registering the thread with the backend, once. Context and language are bound
// when the conversation is built, so there is nothing left here to re-initialize:
// what used to reset the session on every remount now cannot, because the
// messages are not this library's to wipe.

export type ChatRegistry = {
	registerChat(threadId: string, title?: string): Promise<unknown>;
};

export type ChatLifecycleOptions = {
	store: ChatStore;
	registry?: ChatRegistry;
	chatTitle?: (threadId: string) => string;
};

export type ChatLifecycle = {
	threadId: string;
	ensureInitialized(): void;
};

const defaultChatTitle = (threadId: string) => `Chat ${threadId.slice(0, 8)}`;

export const createChatLifecycle = ({
	store,
	registry,
	chatTitle = defaultChatTitle,
}: ChatLifecycleOptions): ChatLifecycle => {
	let registered = false;

	return {
		threadId: store.threadId,
		ensureInitialized: () => {
			if (!registry || registered) return;
			registered = true;
			void registry
				.registerChat(store.threadId, chatTitle(store.threadId))
				.catch((error) => {
					registered = false;
					console.warn("[assistant-state] Failed to register chat", error);
				});
		},
	};
};
