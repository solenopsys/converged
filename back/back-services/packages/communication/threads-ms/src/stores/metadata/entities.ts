import {  PrefixKey, KeyKV } from "back-core";
import { BaseRepositoryKV } from "back-core";
 

type ConversationKey = string;
 
type ConversationEntity = {
    threadId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messagesCount: number;
};

class ConversationRepository extends BaseRepositorySQL<ConversationKey, ConversationEntity> {
}

 