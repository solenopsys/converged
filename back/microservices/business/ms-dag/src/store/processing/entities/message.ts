import { PrefixedRepositoryKV, PrefixKey, KeyKV } from "back-core";

export const MESSAGE_PREFIX = "msg";

export class MessageKey extends PrefixKey implements KeyKV {
  readonly prefix = MESSAGE_PREFIX;

  constructor(
    private contextKey: string,
    private messageId: string,
  ) {
    super();
  }

  build(): string[] {
    return [this.contextKey, this.prefix, this.messageId];
  }
}

export type MessageStatus = "queued" | "processing" | "done" | "failed";

export type MessageValue = {
  id: string;
  type: string;
  payload?: any;
  status: MessageStatus;
  ts: string;
  updatedAt?: string;
  meta?: any;
};

export class MessageRepository extends PrefixedRepositoryKV<MessageKey, MessageValue> {
  getPrefix(): string[] {
    return [MESSAGE_PREFIX];
  }
}
