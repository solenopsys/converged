import { ConversationRepository } from "./entities";

import { SqlStore } from "back-core";

export class MedatataStoreService {
  private readonly store: SqlStore;
  public readonly conversationRepo: ConversationRepository;

  constructor(store: SqlStore) {
    this.store = store;
    this.conversationRepo = new ConversationRepository(store, "conversations", {
      primaryKey: "id",
      extractKey: (conversation) => ({ id: conversation.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async createConversation(threadId: string, title: string) {
    return this.registerConversation(threadId, title);
  }

  async registerConversation(threadId: string, title: string) {
    const now = new Date().getTime();
    const existing = await this.conversationRepo.findById({ id: threadId });

    if (existing) {
      const updated = await this.conversationRepo.update(
        { id: threadId },
        {
          title: title || existing.title,
          updatedAt: now,
        },
      );
      return updated ?? existing;
    }

    return this.conversationRepo.create({
      id: threadId,
      title,
      createdAt: now,
      updatedAt: now,
      messagesCount: 0,
    });
  }

  async recordMessage(threadId: string) {
    const now = new Date().getTime();
    const existing = await this.conversationRepo.findById({ id: threadId });

    if (existing) {
      const updated = await this.conversationRepo.update(
        { id: threadId },
        {
          updatedAt: now,
          messagesCount: (existing.messagesCount ?? 0) + 1,
        },
      );
      return updated ?? existing;
    }

    return this.conversationRepo.create({
      id: threadId,
      title: `Chat ${threadId.slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
      messagesCount: 1,
    });
  }
}
