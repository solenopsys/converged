type ULID = string;
type MessageType = "message" | "link" | "partition";

type Message = {
    threadId: ULID,
    id?: ULID,
    type: MessageType,
    beforeId?: ULID,
    data: string
}

export interface ThreadsService {
    newThread(meta: { description: string, author: string }): Promise<ULID>;
    addText(threadId: ULID, text: string, beforeId?: ULID): Promise<Message>
    addLink(threadId: ULID, link: string, beforeId?: ULID): Promise<Message>
    readHead(threadId: ULID, headItemId: ULID, beforeCount: number): Promise<Message[]>
    readThree(threadId: ULID): Promise<Message[]>
   
}