



 

class MessageKey implements KeyKV {
    threadId: string;
    messageId: string;
    timestamp: number

    build(): string[] {
        return [this.threadId, this.messageId, this.timestamp.toString()];
    }
}


type MessageEntity = Message;
