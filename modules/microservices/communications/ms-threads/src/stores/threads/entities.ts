import {
	BaseRepositoryKV,
	type KeyKV,
	type KVStore,
	PrefixKey,
} from "back-core";

type MessageValue = {
	threadId: string;
	id?: string;
	timestamp?: number;
	beforeId?: string;
	user: string;
	type: string;
	data: string;
};

class MessageKey extends PrefixKey implements KeyKV {
	constructor(
		private threadId: string,
		private messageId: string,
		private timestamp: number,
	) {
		super();
	}

	build(): string[] {
		return [this.threadId, this.messageId, this.timestamp.toString()];
	}
}

class MessageRepository extends BaseRepositoryKV<MessageKey, MessageValue> {
	constructor(store: KVStore) {
		super(store, { prefix: [] });
	}
}

export { MessageKey, MessageRepository, type MessageValue };
