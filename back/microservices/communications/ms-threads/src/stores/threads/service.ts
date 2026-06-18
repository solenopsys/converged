import { generateULID, type KVStore } from "back-core";
import { MessageKey, MessageRepository, type MessageValue } from "./entities";

export class ThreadsStoreService {
	public readonly messageRepo: MessageRepository;

	constructor(private store: KVStore) {
		this.messageRepo = new MessageRepository(store);
	}

	saveMessage(message: MessageValue): string {
		const timestamp = Date.now();
		if (!message.id) {
			message.id = generateULID();
		}
		message.timestamp = timestamp;

		const key = new MessageKey(message.threadId, message.id, timestamp);
		return this.messageRepo.save(key, message);
	}

	readMessage(threadId: string, messageId: string): MessageValue | undefined {
		const versions = this.readMessageVersions(threadId, messageId);
		return versions.length > 0 ? versions[versions.length - 1] : undefined;
	}

	readMessageVersions(threadId: string, messageId: string): MessageValue[] {
		const prefix = [threadId, messageId];
		const keys = this.store.listKeys(prefix);

		return keys
			.map((keyStr) => {
				return this.messageRepo.getDirect(keyStr);
			})
			.filter((m) => m !== undefined) as MessageValue[];
	}

	readThreadAllVersions(threadId: string): MessageValue[] {
		const prefix = [threadId];
		const keys = this.store.listKeys(prefix);

		return keys
			.map((keyStr) => {
				return this.messageRepo.getDirect(keyStr);
			})
			.filter((m) => m !== undefined) as MessageValue[];
	}

	readThread(threadId: string): MessageValue[] {
		const last: Record<string, MessageValue> = {};
		const all = this.readThreadAllVersions(threadId);

		all.forEach((m) => {
			if (m.id) last[m.id] = m;
		});

		return Object.values(last);
	}

	deleteThread(threadId: string): number {
		const keys = this.store.listKeys([threadId]);
		for (const key of keys) {
			this.store.delete(key.split(":"));
		}
		return keys.length;
	}
}
