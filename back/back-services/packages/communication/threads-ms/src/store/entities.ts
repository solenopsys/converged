import {  PrefixKey, KeyKV } from "back-core";
import { BaseRepositoryKV } from "back-core";
 
 
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
        private timestamp: number
    ) {
        super();
    }
    
    build(): string[] {
        return [this.prefix, this.threadId, this.messageId, this.timestamp.toString()];
    }
}


class MessageRepository extends BaseRepositoryKV<MessageKey, MessageValue> {
}

export {  MessageKey, type MessageValue, MessageRepository };
