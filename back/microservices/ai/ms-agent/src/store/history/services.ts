import { BaseRepositorySQL, type SqlStore } from "back-core";
import type {
  SessionKey,
  SessionEntity,
  MessageKey,
  MessageEntity,
} from "./entities";

export class HistoryStoreService {
  public readonly sessions: BaseRepositorySQL<SessionKey, SessionEntity>;
  public readonly messages: BaseRepositorySQL<MessageKey, MessageEntity>;

  constructor(private store: SqlStore) {
    this.sessions = new BaseRepositorySQL<SessionKey, SessionEntity>(
      store,
      "sessions",
      {
        primaryKey: "id",
        extractKey: (s) => ({ id: s.id }),
        buildWhereCondition: (k) => ({ id: k.id }),
      },
    );
    this.messages = new BaseRepositorySQL<MessageKey, MessageEntity>(
      store,
      "messages",
      {
        primaryKey: "id",
        extractKey: (m) => ({ id: m.id }),
        buildWhereCondition: (k) => ({ id: k.id }),
      },
    );
  }

  async getSessionMessages(
    sessionId: string,
    limit: number,
  ): Promise<MessageEntity[]> {
    const results = await this.store.db
      .selectFrom("messages" as any)
      .selectAll()
      .where("sessionId" as any, "=", sessionId)
      .orderBy("createdAt" as any, "asc")
      .limit(limit)
      .execute();

    return results as unknown as MessageEntity[];
  }
}
