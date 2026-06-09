import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ThreadKind } from "g-threads";

export interface ThreadIndexKey extends KeySQL {
  threadId: string;
}

export interface ThreadIndexEntity {
  threadId: string;
  kind: ThreadKind;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export class ThreadIndexRepository extends BaseRepositorySQL<
  ThreadIndexKey,
  ThreadIndexEntity
> {}
