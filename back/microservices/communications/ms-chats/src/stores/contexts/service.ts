import { FileStore } from "back-core";
import type {
  ChatContext,
  ChatContextSummary,
  PaginatedResult,
  PaginationParams,
} from "../../types";

/** Fallback language; contexts are keyed `<lang>/<chatId>.json`
 *  (locale is the top-level key segment, like data/converged/struct-ms). */
const DEFAULT_LANGUAGE = "en";

export class ContextStoreService {
  constructor(private readonly store: FileStore) {}

  private normalizeLanguage(language?: string): string {
    const lang = language?.trim().toLowerCase();
    return lang && lang.length > 0 ? lang : DEFAULT_LANGUAGE;
  }

  private buildKey(chatId: string, language: string): string {
    return `${language}/${chatId}.json`;
  }

  private buildLegacyKey(chatId: string): string {
    return `${chatId}.json`;
  }

  async saveContext(
    chatId: string,
    context: any,
    language?: string,
  ): Promise<ChatContextSummary> {
    const lang = this.normalizeLanguage(language);
    const updatedAt = Date.now();
    const payload: ChatContext = {
      id: chatId,
      chatId,
      language: lang,
      updatedAt,
      data: context,
    };

    const encoded = Buffer.from(JSON.stringify(payload));
    await this.store.put(this.buildKey(chatId, lang), encoded);

    return {
      id: payload.id,
      chatId: payload.chatId,
      language: lang,
      updatedAt: payload.updatedAt,
      size: encoded.length,
    };
  }

  async getContext(
    chatId: string,
    language?: string,
  ): Promise<ChatContext | null> {
    const lang = this.normalizeLanguage(language);

    // requested language → default language → legacy flat key.
    const candidates = [
      this.buildKey(chatId, lang),
      ...(lang !== DEFAULT_LANGUAGE
        ? [this.buildKey(chatId, DEFAULT_LANGUAGE)]
        : []),
      this.buildLegacyKey(chatId),
    ];

    for (const key of candidates) {
      const stored = await this.store.get(key);
      if (!stored) continue;

      const decoded = Buffer.from(stored).toString("utf-8");
      const parsed = JSON.parse(decoded) as Partial<ChatContext>;
      return {
        id: parsed.id ?? chatId,
        chatId: parsed.chatId ?? chatId,
        language: parsed.language ?? lang,
        updatedAt: parsed.updatedAt ?? 0,
        data: parsed.data ?? null,
      };
    }

    return null;
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
        const withoutExt = key.replace(/\.json$/, "");
        const slash = withoutExt.indexOf("/");
        const keyLang = slash >= 0 ? withoutExt.slice(0, slash) : undefined;
        const keyId = slash >= 0 ? withoutExt.slice(slash + 1) : withoutExt;

        const id = parsed.id ?? keyId;
        const chatId = parsed.chatId ?? id;

        summaries.push({
          id,
          chatId,
          language: parsed.language ?? keyLang ?? DEFAULT_LANGUAGE,
          updatedAt: parsed.updatedAt ?? 0,
          size: stored.length,
        });
      } catch (error) {
        console.warn("[ms-chats ContextStoreService] Invalid context file:", key, error);
      }
    }

    summaries.sort((a, b) => b.updatedAt - a.updatedAt);

    const offset = params.offset ?? 0;
    const limit = params.limit ?? summaries.length;

    return { items: summaries.slice(offset, offset + limit), totalCount: summaries.length };
  }
}
