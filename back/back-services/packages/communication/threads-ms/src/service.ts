

export { StoreType, createStore, LMWrapper, newULID, type ULID } from "back-core";
export { type ThreadsService, MessageType, type Message } from './types';
import {ThreadsStoreService} from './store/service';

export class ThreadsServiceImpl implements ThreadsService {
  
    storeService: ThreadsStoreService;

    constructor() {
        this.store = createStore("threads-ms", "threads", StoreType.KVS) as LMWrapper;


        
    }

    async saveMessage(message: Message): Promise<string> { 
        this.storeService.saveMessage(message);
    }

    async readMessage(threadId: ULID, messageId: ULID): Promise<Message> { 
        this.storeService.readMessage(threadId, messageId);
    }

    async readMessageVersions(threadId: ULID, messageId: ULID): Promise<Message[]> { 
        this.storeService.readMessageVersions(threadId, messageId);
    }

    async readThreadAllVersions(threadId: ULID): Promise<Message[]> { 
        this.storeService.readThreadAllVersions(threadId);
    }

    async readThread(threadId: ULID): Promise<Message[]> { 
        this.storeService.readThread(threadId);
    }
}

