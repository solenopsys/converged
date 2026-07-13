import { JsonStore } from "back-core";
import type {
  Context,
  ContextInput,
  ContextListParams,
  ContextLanguage,
  ContextName,
  ContextSummary,
  PaginatedResult,
} from "../../types";

/**
 * Context store. One JSON entity per `<language>/<name>` so a context name can
 * carry localized variants; consumers read by (name, language). The value is
 * the full JSON Context — read directly by centimanus too (same
 * `<language>/<name>.json` key), so the shape is stable.
 */

/** Last-resort language for resolution when none matches (env-overridable). */
const DEFAULT_LANGUAGE = (process.env.CONTEXTS_DEFAULT_LANGUAGE || "en")
  .trim()
  .toLowerCase();

export class ContextStoreService {
  constructor(private readonly store: JsonStore) {}

  private normalizeLanguage(language?: string): string {
    const lang = language?.trim().toLowerCase();
    return lang && lang.length > 0 ? lang : DEFAULT_LANGUAGE;
  }

  /** JsonStore key `<language>/<name>` (it appends `.json` on disk). */
  private buildKey(name: ContextName, language: ContextLanguage): string {
    return `${language}/${name}`;
  }

  async saveContext(input: ContextInput): Promise<ContextSummary> {
    const name = input.name?.trim();
    if (!name) throw new Error("context name is required");
    const language = this.normalizeLanguage(input.language);

    const payload: Context = {
      name,
      language,
      data: input.data,
      updatedAt: Date.now(),
    };
    await this.store.putJson(this.buildKey(name, language), payload);

    return {
      name,
      language,
      updatedAt: payload.updatedAt,
      size: JSON.stringify(payload).length,
    };
  }

  async getContext(
    name: ContextName,
    language?: ContextLanguage,
  ): Promise<Context | null> {
    const lang = this.normalizeLanguage(language);

    // Requested language → default language → any stored variant.
    const direct = await this.store.getJson<Context>(this.buildKey(name, lang));
    if (direct) return this.normalize(direct, lang, name);
    if (lang !== DEFAULT_LANGUAGE) {
      const fallback = await this.store.getJson<Context>(
        this.buildKey(name, DEFAULT_LANGUAGE),
      );
      if (fallback) return this.normalize(fallback, DEFAULT_LANGUAGE, name);
    }
    return this.findAnyVariant(name);
  }

  async listContexts(
    params: ContextListParams,
  ): Promise<PaginatedResult<ContextSummary>> {
    const keys = await this.store.listJsonKeys();
    const wantLang = params.language
      ? this.normalizeLanguage(params.language)
      : undefined;

    const summaries: ContextSummary[] = [];
    for (const key of keys) {
      const parsed = await this.store.getJson<Context>(key);
      if (!parsed) continue;
      const ctx = this.normalize(parsed, this.langOf(key), this.nameOf(key));
      if (wantLang && ctx.language !== wantLang) continue;
      summaries.push({
        name: ctx.name,
        language: ctx.language,
        updatedAt: ctx.updatedAt,
        size: JSON.stringify(ctx).length,
      });
    }

    summaries.sort((a, b) => b.updatedAt - a.updatedAt);
    const offset = params.offset ?? 0;
    const limit = params.limit ?? summaries.length;
    return {
      items: summaries.slice(offset, offset + limit),
      totalCount: summaries.length,
    };
  }

  async deleteContext(
    name: ContextName,
    language?: ContextLanguage,
  ): Promise<boolean> {
    if (language) {
      return this.store.deleteJson(this.buildKey(name, this.normalizeLanguage(language)));
    }
    // No language → drop every localized variant of this name.
    const keys = await this.store.listJsonKeys();
    let deleted = false;
    for (const key of keys) {
      if (this.nameOf(key) === name) {
        deleted = (await this.store.deleteJson(key)) || deleted;
      }
    }
    return deleted;
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /** `<lang>/<name>` → lang. */
  private langOf(key: string): string {
    const slash = key.indexOf("/");
    return slash >= 0 ? key.slice(0, slash) : DEFAULT_LANGUAGE;
  }

  /** `<lang>/<name>` → name. */
  private nameOf(key: string): string {
    const slash = key.indexOf("/");
    return slash >= 0 ? key.slice(slash + 1) : key;
  }

  private normalize(
    parsed: Partial<Context>,
    keyLang: string,
    keyName: string,
  ): Context {
    return {
      name: parsed.name ?? keyName,
      language: parsed.language ?? keyLang,
      data: parsed.data ?? null,
      updatedAt: parsed.updatedAt ?? 0,
    };
  }

  private async findAnyVariant(name: ContextName): Promise<Context | null> {
    const keys = await this.store.listJsonKeys();
    for (const key of keys) {
      if (this.nameOf(key) === name) {
        const parsed = await this.store.getJson<Context>(key);
        if (parsed) return this.normalize(parsed, this.langOf(key), name);
      }
    }
    return null;
  }
}
