

export { StoreType, createStore, LMWrapper, newULID, type ULID } from "back-core";
export { type ThreadsService, MessageType, type Message } from './types';

export class ThreadsServiceImpl implements ThreadsService {
    store: LMWrapper;

    constructor() {
        this.store = createStore("threads-ms", "threads", StoreType.KVS) as LMWrapper;
    }

    async saveMessage(message: Message): Promise<string> {
        const timeStamp = Date.now()
        if (!message.id) {
            message.id = newULID();
        }
        message.timestamp = timeStamp;
        return this.store.put(new MessageKey(message.threadId, message.id, timeStamp), message);
    }

    async readMessage(threadId: ULID, messageId: ULID): Promise<Message> {
        return (await this.readMessageVersions(threadId, messageId)).pop() as Message;
    }

    async readMessageVersions(threadId: ULID, messageId: ULID): Promise<Message[]> {
        return this.store.getValuesRangeAsArrayByPrefixChain([threadId, messageId]);
    }

    async readThreadAllVersions(threadId: ULID): Promise<Message[]> {
        return this.store.getValuesRangeAsArrayByPrefix(threadId);
    }

    async readThread(threadId: ULID): Promise<Message[]> {
        const last:Record<string,Message>={}
        const all= (await this.readThreadAllVersions(threadId));
        all.forEach(m=>{
            last[m.id]=m;
        })
        return Object.values(last);
    }
}

