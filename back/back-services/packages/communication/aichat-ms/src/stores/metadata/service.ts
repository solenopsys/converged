
import { ConversationRepository } from "./entities"

import { SqlStore } from "back-core";

export class MedatataStoreService {
  private readonly store: SqlStore;
  public readonly conversationRepo: ConversationRepository;

  constructor(store: SqlStore) {
    this.store = store;
    this.conversationRepo = new ConversationRepository(store, "conversation",
      {
        primaryKey: 'id',
        extractKey: (conversation) => ({ id: conversation.id }),
        buildWhereCondition: (key) => ({ id: key.id })
      }
    );
  }


  createConversation(threadId:string,title:string){
    this.conversationRepo.create(
      {
        id:threadId,
        title,
        createdAt: new Date().getTime() ,
        updatedAt: new Date().getTime(),
        messagesCount: 1,
      }
    )
  }



}