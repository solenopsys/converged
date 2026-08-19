export { createStore, newULID, StoreType } from "back-core";

import type {
	Message,
	PaginatedResult,
	ThreadInfo,
	ThreadKind,
	ThreadListParams,
	ThreadStats,
	ThreadsService,
	ULID,
} from "g-threads";
import { StoresController } from "./stores";

const MS_ID = "threads-ms";

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
			this.stores = new StoresController(MS_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	private async ready(): Promise<void> {
		await this.init();
	}

	async saveMessage(message: Message): Promise<string> {
		await this.ready();
		const id = this.stores.threads.saveMessage(message);
		// Keep the lightweight stats index in sync for service-routed writes.
		await this.stores.index.touch(message.threadId);
		return id;
	}

	async readMessage(threadId: ULID, messageId: ULID): Promise<Message> {
		return this.stores.threads.readMessage(threadId, messageId) as Message;
	}

	async readMessageVersions(
		threadId: ULID,
		messageId: ULID,
	): Promise<Message[]> {
		return this.stores.threads.readMessageVersions(
			threadId,
			messageId,
		) as Message[];
	}

	async readThreadAllVersions(threadId: ULID): Promise<Message[]> {
		return this.stores.threads.readThreadAllVersions(threadId) as Message[];
	}

	async readThread(threadId: ULID): Promise<Message[]> {
		return this.stores.threads.readThread(threadId) as Message[];
	}

	async deleteThread(threadId: ULID): Promise<number> {
		await this.ready();
		const deleted = this.stores.threads.deleteThread(threadId);
		await this.stores.index.delete(threadId);
		return deleted;
	}

	async registerThread(threadId: ULID, kind: ThreadKind): Promise<void> {
		await this.ready();
		await this.stores.index.register(threadId, kind);
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
}
