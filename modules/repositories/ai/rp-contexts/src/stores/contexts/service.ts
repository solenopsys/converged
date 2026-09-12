import type { JsonStore } from "back-core";
import type {
	Context,
	ContextInput,
	ContextLanguage,
	ContextListParams,
	ContextName,
	ContextSummary,
	FilterObject,
	PaginatedResult,
} from "../../types";

const DEFAULT_LANGUAGE = (process.env.CONTEXTS_DEFAULT_LANGUAGE || "en")
	.trim()
	.toLowerCase();

/**
 * A context name and its language both become path segments, and both arrive
 * from the caller. A separator or a dot segment walks out of the store, so the
 * shape is fixed here — the same guard `rp-chats` puts on its own context keys.
 *
 * This store keeps no tags of its own, and per `access-control.md` it should
 * not: the file name is the object id, and access to it is the access of the
 * record that points at it. Contexts are addressed by name rather than owned,
 * so the thing worth defending is the path, not a row.
 */
const NAME_SHAPE = /^[A-Za-z0-9_.-]{1,128}$/;
const LANGUAGE_SHAPE = /^[a-z]{2,8}(-[a-z0-9]{2,8})?$/;

function requireStorableName(name: string): string {
	const trimmed = name?.trim() ?? "";
	if (!NAME_SHAPE.test(trimmed) || trimmed.includes(".."))
		throw new Error(`Unusable context name: ${name}`);
	return trimmed;
}

function requireStorableLanguage(language: string): string {
	if (!LANGUAGE_SHAPE.test(language))
		throw new Error(`Unusable context language: ${language}`);
	return language;
}

export class ContextStoreService {
	constructor(private readonly store: JsonStore) {}

	private normalizeLanguage(language?: string): string {
		const lang = language?.trim().toLowerCase();
		return lang && lang.length > 0 ? lang : DEFAULT_LANGUAGE;
	}

	private buildKey(name: ContextName, language: ContextLanguage): string {
		return `${requireStorableLanguage(language)}/${requireStorableName(name)}`;
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
		const languageFilter = this.languageFromFilter(params.filter);

		const summaries: ContextSummary[] = [];
		for (const key of keys) {
			const parsed = await this.store.getJson<Context>(key);
			if (!parsed) continue;
			const ctx = this.normalize(parsed, this.langOf(key), this.nameOf(key));
			if (wantLang && ctx.language !== wantLang) continue;
			if (languageFilter && !this.matchesLanguage(ctx.language, languageFilter))
				continue;
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

	private languageFromFilter(
		filter?: FilterObject,
	): Record<string, unknown> | undefined {
		const clause = filter?.language;
		return clause && typeof clause === "object"
			? (clause as Record<string, unknown>)
			: undefined;
	}

	private matchesLanguage(
		language: string,
		clause: Record<string, unknown>,
	): boolean {
		if (typeof clause.eq === "string") return language === clause.eq;
		if (typeof clause.contains === "string")
			return language.includes(clause.contains);
		if (Array.isArray(clause.in)) return clause.in.includes(language);
		return true;
	}

	async deleteContext(
		name: ContextName,
		language?: ContextLanguage,
	): Promise<boolean> {
		if (language) {
			return this.store.deleteJson(
				this.buildKey(name, this.normalizeLanguage(language)),
			);
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

	private langOf(key: string): string {
		const slash = key.indexOf("/");
		return slash >= 0 ? key.slice(0, slash) : DEFAULT_LANGUAGE;
	}

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
