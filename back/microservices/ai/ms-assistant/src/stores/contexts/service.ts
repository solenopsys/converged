import { FileStore } from "back-core";
import {
  type ChatContext,
  type ChatContextSummary,
  type PaginatedResult,
  type PaginationParams,
} from "../../types";

export class ContextStoreService {
  constructor(private readonly store: FileStore) {}

  private buildKey(chatId: string): string {
    return `${chatId}.json`;
  }

  async saveContext(chatId: string, context: any): Promise<ChatContextSummary> {
    const updatedAt = Date.now();
    const payload: ChatContext = {
      id: chatId,
      chatId,
      updatedAt,
      data: context,
    };

    const encoded = Buffer.from(JSON.stringify(payload));
    await this.store.put(this.buildKey(chatId), encoded);

    return {
      id: payload.id,
      chatId: payload.chatId,
      updatedAt: payload.updatedAt,
      size: encoded.length,
    };
  }

  async getContext(chatId: string): Promise<ChatContext | null> {
    const stored = await this.store.get(this.buildKey(chatId));
    if (!stored) return null;

    const decoded = Buffer.from(stored).toString("utf-8");
    const parsed = JSON.parse(decoded) as Partial<ChatContext>;

    return {
      id: parsed.id ?? chatId,
      chatId: parsed.chatId ?? chatId,
      updatedAt: parsed.updatedAt ?? 0,
      data: parsed.data ?? null,
    };
  }

  async listContexts(
    params: PaginationParams,
  ): Promise<PaginatedResult<ChatContextSummary>> {
    const keys = await this.store.listKeys();
    const summaries: ChatContextSummary[] = [];

    for (const key of keys) {
      if (!key.endsWith(".json")) continue;
      const stored = await this.store.get(key);
      if (!stored) continue;

      try {
        const decoded = Buffer.from(stored).toString("utf-8");
        const parsed = JSON.parse(decoded) as Partial<ChatContext>;
        const id = parsed.id ?? key.replace(/\.json$/, "");
        const chatId = parsed.chatId ?? id;

        summaries.push({
          id,
          chatId,
          updatedAt: parsed.updatedAt ?? 0,
          size: stored.length,
        });
      } catch (error) {
        console.warn("[ContextStoreService] Invalid context file:", key, error);
      }
    }

    summaries.sort((a, b) => b.updatedAt - a.updatedAt);

    const offset = params.offset ?? 0;
    const limit = params.limit ?? summaries.length;

    const items = summaries.slice(offset, offset + limit);

    return { items, totalCount: summaries.length };
  }
}
