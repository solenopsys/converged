export type ULID = string;

export enum MessageType {
	message = "message",
	link = "link",
	partition = "partition",
}

export type Message = {
	threadId: ULID;
	id?: ULID;
	timestamp?: number;
	beforeId?: ULID;
	user: string;
	type: MessageType;
	data: string;
};

// What a thread belongs to — kept in a lightweight SQL index purely for stats.
//   chat    — text assistant chat
//   audio   — audio call transcript (ms-calls owns the call)
//   forum   — forum threads
//   comment — comment threads under various entities
export type ThreadKind = "chat" | "audio" | "forum" | "comment";

export type ThreadInfo = {
	threadId: ULID;
	kind: ThreadKind;
	messageCount: number;
	createdAt: number;
	updatedAt: number;
};

export type ThreadListParams = {
	offset?: number;
	limit?: number;
	kind?: ThreadKind;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type ThreadStats = {
	total: number;
	totalMessages: number;
	byKind: Record<ThreadKind, number>;
};

export interface ThreadsService {
	saveMessage(message: Message): Promise<string>;
	readMessage(threadId: ULID, messageId: ULID): Promise<Message>;
	readMessageVersions(threadId: ULID, messageId: ULID): Promise<Message[]>;
	readThreadAllVersions(threadId: ULID): Promise<Message[]>;
	readThread(threadId: ULID): Promise<Message[]>;
	deleteThread(threadId: ULID): Promise<number>;

	// Lightweight metadata index (stats only).
	registerThread(threadId: ULID, kind: ThreadKind): Promise<void>;
	listThreads(params: ThreadListParams): Promise<PaginatedResult<ThreadInfo>>;
	getThreadStats(): Promise<ThreadStats>;
}
