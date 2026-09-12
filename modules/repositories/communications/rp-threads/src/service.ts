export { createStore, newULID, StoreType } from "back-core";

import type {
	FilterObject,
	Message,
	PaginatedResult,
	SelectionDescriptor,
	SelectionStats,
	ThreadAccessInput,
	ThreadInfo,
	ThreadKind,
	ThreadListParams,
	ThreadStats,
	ThreadsService,
	ULID,
} from "g-threads";
import { getCurrentWorkspaceContext } from "nrpc";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-threads";

/**
 * Who is calling, from the verified token and from nothing else.
 *
 * This repository is the one the browser talks to directly — surfaces read
 * threads without a room or a topic in between — so the token is the only thing
 * standing between a guessed thread id and somebody else's conversation.
 */
function requireActor(): string {
	const actor = getCurrentWorkspaceContext()?.user?.trim();
	if (!actor) throw new Error("Authenticated caller is required");
	return actor;
}

export default class ThreadsServiceImpl implements ThreadsService {
	stores: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(REPOSITORY_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	private async ready(): Promise<void> {
		await this.init();
	}

	/**
	 * Posts to a thread the caller can already read.
	 *
	 * Reading is the right bar rather than owning: a forum topic open to a group
	 * is a topic that group replies in. A thread nobody has registered yet is
	 * claimed by this first write — see `touch`.
	 */
	async saveMessage(message: Message): Promise<string> {
		await this.ready();
		const actor = requireActor();
		if (await this.stores.index.exists(message.threadId)) {
			await this.stores.index.access.requireRead(message.threadId);
		}
		const id = this.stores.threads.saveMessage(message);
		// Keep the lightweight stats index in sync for service-routed writes.
		await this.stores.index.touch(message.threadId, actor);
		return id;
	}

	async readMessage(threadId: ULID, messageId: ULID): Promise<Message> {
		await this.requireThreadRead(threadId);
		return this.stores.threads.readMessage(threadId, messageId) as Message;
	}

	async readMessageVersions(
		threadId: ULID,
		messageId: ULID,
	): Promise<Message[]> {
		await this.requireThreadRead(threadId);
		return this.stores.threads.readMessageVersions(
			threadId,
			messageId,
		) as Message[];
	}

	async readThreadAllVersions(threadId: ULID): Promise<Message[]> {
		await this.requireThreadRead(threadId);
		return this.stores.threads.readThreadAllVersions(threadId) as Message[];
	}

	async readThread(threadId: ULID): Promise<Message[]> {
		await this.requireThreadRead(threadId);
		return this.stores.threads.readThread(threadId) as Message[];
	}

	async deleteThread(threadId: ULID): Promise<number> {
		await this.ready();
		requireActor();
		await this.stores.index.access.requireWrite(threadId);
		const deleted = this.stores.threads.deleteThread(threadId);
		await this.stores.index.delete(threadId);
		return deleted;
	}

	/**
	 * Declares a thread's kind and, the first time, who may read it.
	 *
	 * This is the seam between a conversation and the thing it belongs to. A room
	 * lives in `rp-chats` and a topic in `rp-community`, and neither may call
	 * here — repositories do not call each other — so the surface that created
	 * the object registers its thread. What keeps that honest is that the caller
	 * can only ever open a thread it already holds: registering an existing
	 * thread requires a tag of the caller's own, so a guessed id re-tags nothing.
	 */
	async registerThread(
		threadId: ULID,
		kind: ThreadKind,
		access?: ThreadAccessInput,
	): Promise<void> {
		await this.ready();
		const actor = requireActor();
		if (await this.stores.index.exists(threadId)) {
			await this.stores.index.access.requireWrite(threadId);
		}
		await this.stores.index.register(threadId, kind, {
			visibility: access?.visibility,
			owner: actor,
			tags: access?.tags,
		});
	}

	/**
	 * Opens a thread to one person, effective on their next request.
	 *
	 * Only from a thread the caller already holds, which is what makes this safe
	 * to expose to a browser: it delegates access it has, never access it wants.
	 */
	async grantThreadAccess(threadId: ULID, userId: string): Promise<void> {
		await this.ready();
		requireActor();
		await this.stores.index.access.requireWrite(threadId);
		await this.stores.index.access.grantToUser(threadId, userId);
	}

	async revokeThreadAccess(threadId: ULID, userId: string): Promise<void> {
		await this.ready();
		requireActor();
		await this.stores.index.access.requireWrite(threadId);
		await this.stores.index.access.revokeFromUser(threadId, userId);
	}

	async readThreadAccess(threadId: ULID): Promise<string[]> {
		await this.requireThreadRead(threadId);
		return this.stores.index.access.tagsOf(threadId);
	}

	async listThreads(
		params: ThreadListParams,
	): Promise<PaginatedResult<ThreadInfo>> {
		await this.ready();
		return this.stores.index.list(params ?? {});
	}

	async getThreadStats(): Promise<ThreadStats> {
		await this.ready();
		return this.stores.index.stats();
	}

	/**
	 * The check every content read starts with. A thread with no tags at all —
	 * never registered, never written through this service — is readable by
	 * nobody, which is the safe direction to fail in.
	 */
	private async requireThreadRead(threadId: ULID): Promise<void> {
		await this.ready();
		requireActor();
		await this.stores.index.access.requireRead(threadId);
	}

	async describeSelection(objectType: string): Promise<SelectionDescriptor> {
		if (objectType !== "threads.thread") {
			throw new Error(`Unsupported threads selection object: ${objectType}`);
		}
		return {
			objectType,
			title: "Threads",
			fields: [
				{
					id: "threadId",
					label: "Thread",
					valueType: "string",
					operators: ["eq", "in", "contains", "startsWith"],
				},
				{
					id: "kind",
					label: "Kind",
					valueType: "enum",
					operators: ["eq", "in", "notEq", "notIn"],
				},
				{
					id: "messageCount",
					label: "Messages",
					valueType: "number",
					operators: ["eq", "notEq", "gt", "gte", "lt", "lte", "between"],
				},
				{
					id: "updatedAt",
					label: "Updated",
					valueType: "number",
					operators: ["gt", "gte", "lt", "lte", "between"],
				},
			],
			revision: "threads-v1",
		};
	}

	async inspectThreads(filter?: FilterObject): Promise<SelectionStats> {
		await this.ready();
		return { totalCount: await this.stores.index.count(filter) };
	}
}
