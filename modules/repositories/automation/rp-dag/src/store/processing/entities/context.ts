import { PrefixedRepositoryKV, PrefixKey, KeyKV } from "back-core";

export const CONTEXT_PREFIX = "context";

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
