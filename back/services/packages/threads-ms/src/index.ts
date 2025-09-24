

// services/MailingServiceImpl.ts
import  { type ThreadsService, MessageType, type Message } from '../../../../../types/threads';
import { StoreType, createStore, LMWrapper, newULID, type ULID } from "back-core";
const THREAD = "thread";
const HEAD = "head";
const META = "meta";



class ThreadsServiceImpl implements ThreadsService {
    store: LMWrapper;

    constructor() {
        this.store = createStore("threads-ms", "threads", StoreType.KVS) as LMWrapper;
    }

    async newThread(meta: { description: string, author: string }): Promise<ULID> {
        const threadId = newULID();
        this.store.put([THREAD, threadId, META], meta);
        return threadId;
    }

    async addItem(threadId: ULID, data: string, type: MessageType, beforeId?: ULID): Promise<Message> {
        const messageId = newULID();
        if (beforeId) {
            this.store.put([messageId], beforeId);
        }

        this.store.put([messageId], {
            type: MessageType.message,
            data
        });
        return {
            threadId,
            id: messageId,
            type: MessageType.message,
            data
        };
    }

    async moveHead(threadId: ULID, itemId: ULID): Promise<void> {
        const beforeN = this.store.get([THREAD, threadId, HEAD]);
        // scan and replace
        const n = beforeN ? beforeN + 1 : 1;
        this.store.put([THREAD, threadId, HEAD, n], itemId);
    }


    async addText(threadId: ULID, text: string, beforeId?: ULID): Promise<Message> {
        return this.addItem(threadId, text, MessageType.message, beforeId);
    }

    async addLink(threadId: ULID, link: string, beforeId?: ULID): Promise<Message> {
        return this.addItem(threadId, link, MessageType.link, beforeId);
    }

    async readHead(threadId: ULID, headItemId: ULID, beforeCount: number): Promise<Message[]> {
        const messages: Message[] = [];
        let beforeId = headItemId;
        for (let i = 0; i < beforeCount; i++) {
            const messageId = this.store.get([beforeId]);
            if (messageId) {
                const message = this.store.get([ threadId, messageId]);
                messages.push(message);
                beforeId = message.beforeId;
            }
        }
        return messages;
    }

    async readThree(threadId: ULID): Promise<Message[]> {

       // return this.store.getVeluesRangeAsObjectWithPrefix(threadId);
       return []; //todo 
    }
}

export default ThreadsServiceImpl;