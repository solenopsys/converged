import { PrefixedRepositoryKV, SimpleKey, PrefixKey, KeyKV } from "back-core";

// ============ Context ============
const CONTEXT_PREFIX = "context";

export class ContextKey extends PrefixKey implements KeyKV {
  readonly prefix = CONTEXT_PREFIX;

  constructor(
    private workflowHash: string,
    private contextId: string,
  ) {
    super();
  }

  build(): string[] {
    return [this.prefix, this.workflowHash, this.contextId];
  }
}

export type ContextValue = {
  createdAt: string;
  meta?: any;
};

export class ContextRepository extends PrefixedRepositoryKV<ContextKey, ContextValue> {
  getPrefix(): string[] {
    return [CONTEXT_PREFIX];
  }
}

// ============ Message ============
const MESSAGE_PREFIX = "msg";

export class MessageKey extends PrefixKey implements KeyKV {
  readonly prefix = MESSAGE_PREFIX;

  constructor(
    private contextKey: string,
    private messageId: string,
  ) {
    super();
  }

  build(): string[] {
    // Ключ: contextKey:msg:messageId - сообщение внутри контекста
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

// ============ Aspect Log ============
const ASPECT_PREFIX = "aspect";

export class AspectKey extends PrefixKey implements KeyKV {
  readonly prefix = ASPECT_PREFIX;

  constructor(
    private contextKey: string,
    private aspectId: string,
    private phase: string,
  ) {
    super();
  }

  build(): string[] {
    // Ключ: contextKey:aspect:aspectId:phase - аспект внутри контекста
    return [this.contextKey, this.prefix, this.aspectId, this.phase];
  }
}

export type AspectPhase = "start" | "end" | "error";

export type AspectValue = {
  id: string;
  aspect: string;
  phase: AspectPhase;
  ts: string;
  data?: any;
  error?: string;
};

export class AspectRepository extends PrefixedRepositoryKV<AspectKey, AspectValue> {
  getPrefix(): string[] {
    return [ASPECT_PREFIX];
  }
}

// ============ Persistent ============
const PERSISTENT_PREFIX = "persistent";

export class PersistentKey extends SimpleKey {
  readonly prefix = PERSISTENT_PREFIX;
}

export type PersistentValue = any;

export class PersistentRepository extends PrefixedRepositoryKV<PersistentKey, PersistentValue> {
  getPrefix(): string[] {
    return [PERSISTENT_PREFIX];
  }
}

export {
  CONTEXT_PREFIX,
  MESSAGE_PREFIX,
  ASPECT_PREFIX,
  PERSISTENT_PREFIX,
};
