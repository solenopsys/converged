export type ULID = string;

export enum MessageType {
  message = "message",
  link = "link",
  partition = "partition",
}

export type Message = {
  threadId: ULID;
  id?: ULID;
  timestamp?: number;
  beforeId?: ULID;
  user: string;
  type: MessageType;
  data: string;
};

export interface ThreadsService {
  saveMessage(message: Message): Promise<string>;
  readMessage(threadId: ULID, messageId: ULID): Promise<Message>;
  readMessageVersions(threadId: ULID, messageId: ULID): Promise<Message[]>;
  readThreadAllVersions(threadId: ULID): Promise<Message[]>;
  readThread(threadId: ULID): Promise<Message[]>;
}
