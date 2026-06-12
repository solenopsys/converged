import { FileStore } from "back-core";
import type {
  CallContext,
  CallContextListParams,
  CallContextName,
  CallContextSummary,
  PaginatedResult,
} from "../../types";

const CONTEXT_PREFIX = "llm-context:";

export class ContextStoreService {
  constructor(private readonly store: FileStore) {}

  private buildMetadataKey(name: CallContextName): string {
    return `contexts/${encodeURIComponent(name)}.json`;
  }

  private buildLegacyKey(name: CallContextName): string {
    return `${CONTEXT_PREFIX}${name}`;
  }

  private toPromptText(context: unknown): string {
    if (typeof context === "string") return context;
    return JSON.stringify(context, null, 2) ?? "";
  }

  private decodeLegacyValue(stored: Uint8Array): string {
    const decoded = Buffer.from(stored).toString("utf-8");
    try {
      const parsed = JSON.parse(decoded);
      return typeof parsed === "string" ? parsed : decoded;
    } catch {
      return decoded;
    }
  }

  async saveContext(
    name: CallContextName,
    context: unknown,
  ): Promise<CallContextSummary> {
    const updatedAt = Date.now();
    const legacyKey = this.buildLegacyKey(name);
    const payload: CallContext = {
      id: name,
      name,
      updatedAt,
      data: context,
      legacyKey,
    };

    const encoded = Buffer.from(JSON.stringify(payload));
    await this.store.put(this.buildMetadataKey(name), encoded);

    const promptText = this.toPromptText(context);
    await this.store.put(legacyKey, Buffer.from(JSON.stringify(promptText)));

    return {
      id: payload.id,
      name: payload.name,
      updatedAt: payload.updatedAt,
      size: encoded.length,
      legacyKey,
    };
  }

  async getContext(name: CallContextName): Promise<CallContext | null> {
    const metadataKey = this.buildMetadataKey(name);
    const stored = await this.store.get(metadataKey);
    if (stored) {
      const decoded = Buffer.from(stored).toString("utf-8");
      const parsed = JSON.parse(decoded) as Partial<CallContext>;
      return {
        id: parsed.id ?? name,
        name: parsed.name ?? name,
        updatedAt: parsed.updatedAt ?? 0,
        data: parsed.data ?? null,
        legacyKey: parsed.legacyKey ?? this.buildLegacyKey(name),
      };
    }

    const legacyKey = this.buildLegacyKey(name);
    const legacy = await this.store.get(legacyKey);
    if (!legacy) return null;

    return {
      id: name,
      name,
      updatedAt: 0,
      data: this.decodeLegacyValue(legacy),
      legacyKey,
    };
  }

  async listContexts(
    params: CallContextListParams,
  ): Promise<PaginatedResult<CallContextSummary>> {
    const keys = await this.store.listKeys();
    const summariesByName = new Map<CallContextName, CallContextSummary>();

    for (const key of keys) {
      if (!key.startsWith("contexts/") || !key.endsWith(".json")) continue;
      const stored = await this.store.get(key);
      if (!stored) continue;

      try {
        const decoded = Buffer.from(stored).toString("utf-8");
        const parsed = JSON.parse(decoded) as Partial<CallContext>;
        const keyName = key.slice("contexts/".length).replace(/\.json$/, "");
        const name = parsed.name ?? decodeURIComponent(keyName);

        summariesByName.set(name, {
          id: parsed.id ?? name,
          name,
          updatedAt: parsed.updatedAt ?? 0,
          size: stored.length,
          legacyKey: parsed.legacyKey ?? this.buildLegacyKey(name),
        });
      } catch (error) {
        console.warn("[CallContextStoreService] Invalid context file:", key, error);
      }
    }

    for (const key of keys) {
      if (!key.startsWith(CONTEXT_PREFIX)) continue;
      const name = key.slice(CONTEXT_PREFIX.length);
      if (summariesByName.has(name)) continue;

      const stored = await this.store.get(key);
      summariesByName.set(name, {
        id: name,
        name,
        updatedAt: 0,
        size: stored?.length,
        legacyKey: key,
      });
    }

    const summaries = [...summariesByName.values()].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );

    const offset = params.offset ?? 0;
    const limit = params.limit ?? summaries.length;

    return {
      items: summaries.slice(offset, offset + limit),
      totalCount: summaries.length,
    };
  }

  async deleteContext(name: CallContextName): Promise<boolean> {
    const deletedMetadata = await this.store.delete(this.buildMetadataKey(name));
    const deletedLegacy = await this.store.delete(this.buildLegacyKey(name));
    return deletedMetadata || deletedLegacy;
  }
}
