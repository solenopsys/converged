// ms-contexts — the single, utilitarian owner of LLM contexts (the prompt +
// language an assistant / voice gate / agent runs with). Other services
// (ms-assistant, ms-agent, resonus, landing) only READ contexts from
// here; they do not store their own.
//
// Storage key is `<language>/<name>` — one file per language, SAME name across
// languages (e.g. en/request, ru/request). Consumers read by (name, language).

export type ContextName = string;
/** BCP-47 / ISO language code, the top path segment of a context key. */
export type ContextLanguage = string;

export type Context = {
  name: ContextName;
  language: ContextLanguage;
  /** Prompt text (voice/chat) or a structured payload — consumer-defined. */
  data: unknown;
  updatedAt: number;
};

export type ContextInput = {
  name: ContextName;
  language: ContextLanguage;
  data: unknown;
};

export type ContextSummary = {
  name: ContextName;
  language: ContextLanguage;
  updatedAt: number;
  size?: number;
};

export type ContextListParams = {
  offset?: number;
  limit?: number;
  /** Filter to a single language when set. */
  language?: ContextLanguage;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount: number;
};

export interface ContextsService {
  /** Create/replace the `<language>/<name>` context. */
  saveContext(input: ContextInput): Promise<ContextSummary>;
  /**
   * Load a context by name. When `language` is given, resolve that variant,
   * else the default language, else any stored variant. Null if none exists.
   */
  getContext(
    name: ContextName,
    language?: ContextLanguage,
  ): Promise<Context | null>;
  listContexts(params: ContextListParams): Promise<PaginatedResult<ContextSummary>>;
  deleteContext(name: ContextName, language?: ContextLanguage): Promise<boolean>;
}
