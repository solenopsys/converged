

export { StoreType, createStore, LMWrapper, newULID, type ULID } from "back-core";
import { type ThreadsService, MessageType, type Message } from '../../../../../../types/threads';
import {StoresController} from './store';

import { type ULID } from "back-core";

export class ThreadsServiceImpl implements ThreadsService {
  
    stores: StoresController;

    constructor() {
        this.stores = new StoresController("threads-ms");
    }

    async saveMessage(message: Message): Promise<string> { 
        return this.stores.threads.saveMessage(message);
    }

    async readMessage(threadId: ULID, messageId: ULID): Promise<Message> { 
        return this.stores.threads.readMessage(threadId, messageId) as Message;
    }

    async readMessageVersions(threadId: ULID, messageId: ULID): Promise<Message[]> { 
        return this.stores.threads.readMessageVersions(threadId, messageId) as Message[];
    }

    async readThreadAllVersions(threadId: ULID): Promise<Message[]> { 
        return this.stores.threads.readThreadAllVersions(threadId) as Message[];
    }

    async readThread(threadId: ULID): Promise<Message[]> { 
        return this.stores.threads.readThread(threadId) as Message[];
    }
}

