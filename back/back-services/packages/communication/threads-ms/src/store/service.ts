
import { MessageRepository } from "./entities";
import { KVDB } from "back-core";
import { MessageValue } from "./entities";
import { generateULID } from "back-core";
import { MessageKey } from "./entities"; 


export class ThreadsStoreService {
    public readonly messageRepo: MessageRepository;

    constructor(private db: KVDB) {
        this.messageRepo = new MessageRepository(db);
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
        const prefix = [ threadId, messageId];
        const keys = this.db.listKeys(prefix);
        
        return keys.map(keyStr => { 
            return this.messageRepo.getDirect(keyStr);
        }).filter(m => m !== undefined) as MessageValue[];
    }

    readThreadAllVersions(threadId: string): MessageValue[] {
        const prefix = [ threadId];
        const keys = this.db.listKeys(prefix);
        
        return keys.map(keyStr => { 
            return this.messageRepo.getDirect(keyStr);
        }).filter(m => m !== undefined) as MessageValue[];
    }

    readThread(threadId: string): MessageValue[] {
        const last: Record<string, MessageValue> = {};
        const all = this.readThreadAllVersions(threadId);
        
        all.forEach(m => {
            last[m.id] = m;
        });
        
        return Object.values(last);
    }
}