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
//   audio   — audio call transcript (rp-calls owns the call)
//   forum   — forum threads
//   comment — comment threads under various entities
export type ThreadKind = "chat" | "audio" | "forum" | "comment";

/**
 * Who may read a thread. The mechanism is the shared `access_tags` relation
 * described in `access-control.md`: the owner is the tag `u-<userId>`, a group
 * is a tag of its own, and `public` / `authenticated` are well-known tags.
 * There is no owner column and no tag array.
 */
export type ThreadVisibility =
	| "public"
	| "authenticated"
	| "private"
	| "tagged";

/**
 * What a caller may declare about a thread it is registering.
 *
 * Deliberately absent: the owner. It is read from the verified token, because
 * a caller that names the owner can name somebody else — the same hole that
 * `createdBy` used to be on the forum.
 *
 * `tags` widens the caller's own thread and nothing else. Registering a thread
 * that already carries tags requires the caller to be matched by one of them,
 * so a stranger cannot re-tag a conversation into their own reach.
 */
export type ThreadAccessInput = {
	visibility?: ThreadVisibility;
	tags?: string[];
};

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
	filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;
export type SelectionFieldDescriptor = {
	id: string;
	label: string;
	valueType: "string" | "number" | "boolean" | "date" | "enum";
	operators: string[];
};
export type SelectionDescriptor = {
	objectType: string;
	title: string;
	fields: SelectionFieldDescriptor[];
	filterExample?: FilterObject;
	revision?: string;
};
export type SelectionStats = { totalCount: number };

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

	// Lightweight metadata index (stats only) plus the thread's own access tags.
	registerThread(
		threadId: ULID,
		kind: ThreadKind,
		access?: ThreadAccessInput,
	): Promise<void>;

	/**
	 * Opens a thread to one person, effective immediately.
	 *
	 * This is how a chat room's membership reaches its conversation. `rp-chats`
	 * cannot do it — repositories do not call each other — so the surface that
	 * added the member calls this with the room's `threadId`.
	 */
	grantThreadAccess(threadId: ULID, userId: string): Promise<void>;
	revokeThreadAccess(threadId: ULID, userId: string): Promise<void>;
	/** The tags this thread carries, for a caller that may already read it. */
	readThreadAccess(threadId: ULID): Promise<string[]>;
	listThreads(params: ThreadListParams): Promise<PaginatedResult<ThreadInfo>>;
	getThreadStats(): Promise<ThreadStats>;
	describeSelection(objectType: string): Promise<SelectionDescriptor>;
	inspectThreads(filter?: FilterObject): Promise<SelectionStats>;
}
