import { PrefixKey, KeyKV } from "back-core";
import { BaseRepositorySQL, KeySQL } from "back-core";

export interface ConversationKey extends KeySQL {
  id: string;
}

export interface ConversationEntity {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messagesCount: number;
}

export class ConversationRepository extends BaseRepositorySQL<
  ConversationKey,
  ConversationEntity
> {}
