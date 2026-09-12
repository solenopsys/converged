import {
  AccessTags,
  applyKyselyFilter,
  SqlStore,
  generateULID,
  type KyselyFilterSchema,
  visibleFrom,
} from "back-core";
import type {
  WebhookEndpoint,
  WebhookEndpointInput,
  WebhookEndpointUpdate,
  WebhookEndpointListParams,
  WebhookLogEntry,
  WebhookLogListParams,
  WebhookVerification,
  PaginatedResult,
} from "../../types";

const endpointFilterSchema: KyselyFilterSchema = {
  id: { valueType: "string", operators: ["eq", "in"], column: "obj.id" },
  slug: { valueType: "string", operators: ["eq", "in", "contains", "startsWith"], column: "obj.slug" },
  name: { valueType: "string", operators: ["eq", "in", "contains", "startsWith"], column: "obj.name" },
  provider: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"], column: "obj.provider" },
  enabled: { valueType: "boolean", operators: ["eq", "notEq"], column: "obj.enabled" },
  createdAt: { valueType: "date", operators: ["gt", "gte", "lt", "lte", "between"], column: "obj.createdAt" },
};

const logFilterSchema: KyselyFilterSchema = {
  id: { valueType: "number", operators: ["eq", "in", "gt", "gte", "lt", "lte", "between"], column: "log.id" },
  endpointId: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"], column: "log.endpointId" },
  provider: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"], column: "log.provider" },
  method: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"], column: "log.method" },
  path: { valueType: "string", operators: ["eq", "contains", "startsWith"], column: "log.path" },
  status: { valueType: "number", operators: ["eq", "in", "gt", "gte", "lt", "lte", "between", "isNull"], column: "log.status" },
  createdAt: { valueType: "date", operators: ["gt", "gte", "lt", "lte", "between"], column: "log.createdAt" },
};

export class WebhooksStoreService {
  /**
   * Who may see which endpoint.
   *
   * An endpoint is the installation's integration, created `authenticated` with
   * the tag of whoever created it, so the console keeps showing what it showed
   * and an untokened caller no longer reads the list — which is also the list of
   * shared secrets. Editing and deleting are the owner's or a `team-*` holder's.
   *
   * Two paths deliberately stay outside the narrowing, because neither has an
   * actor to narrow by: `getEndpointBySlug`, which the gateway calls to resolve
   * an inbound delivery — the slug in the URL is what the producer was given,
   * and is the credential there — and `createLog`, which records that delivery
   * afterwards. Slug uniqueness is checked through the same unnarrowed lookup on
   * purpose: two endpoints with one slug would be one address with two owners.
   */
  readonly access: AccessTags;

  constructor(private store: SqlStore) {
    this.access = new AccessTags(store);
  }

  async createEndpoint(input: WebhookEndpointInput): Promise<WebhookEndpoint> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    const enabled = input.enabled ?? true;
    const slug = await this.uniqueSlug(input.slug ?? input.name, id);
    const verify: WebhookVerification = input.verify ?? "secret";

    await this.store.db
      .insertInto("webhook_endpoints")
      .values({
        id,
        slug,
        name: input.name,
        provider: input.provider,
        topic: input.topic ?? null,
        verify,
        params: input.params ? JSON.stringify(input.params) : null,
        enabled: enabled ? 1 : 0,
        createdAt,
        updatedAt: createdAt,
      })
      .execute();

    await this.access.tagNew(id, { visibility: "authenticated" });

    return {
      id,
      slug,
      name: input.name,
      provider: input.provider,
      topic: input.topic,
      verify,
      params: input.params,
      enabled,
      createdAt,
      updatedAt: createdAt,
    };
  }

  /**
   * Resolution for the gateway: by address, not by actor. See the note on
   * `access` for why this one is not narrowed.
   */
  async getEndpointBySlug(slug: string): Promise<WebhookEndpoint | null> {
    const row = await this.store.db
      .selectFrom("webhook_endpoints")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();

    return row ? this.mapEndpointRow(row as any) : null;
  }

  /**
   * A readable slug derived from the name, kept unique by suffixing. Falls back
   * to the id, which is unique by construction, when the name has nothing
   * URL-safe in it at all.
   */
  private async uniqueSlug(source: string, id: string): Promise<string> {
    const base = source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    if (!base) return id;

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const taken = await this.getEndpointBySlug(candidate);
      if (!taken) return candidate;
    }
    return id;
  }

  async updateEndpoint(id: string, updates: WebhookEndpointUpdate): Promise<WebhookEndpoint | null> {
    await this.access.requireWrite(id);
    const existing = await this.getEndpoint(id);
    if (!existing) {
      return null;
    }

    const updatedAt = new Date().toISOString();
    const next = {
      ...existing,
      ...updates,
      enabled: updates.enabled ?? existing.enabled,
      updatedAt,
    } as WebhookEndpoint;

    await this.store.db
      .updateTable("webhook_endpoints")
      .set({
        slug: next.slug,
        name: next.name,
        provider: next.provider,
        topic: next.topic ?? null,
        verify: next.verify,
        params: next.params ? JSON.stringify(next.params) : null,
        enabled: next.enabled ? 1 : 0,
        updatedAt,
      })
      .where("id", "=", id)
      .execute();

    return next;
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    await this.access.requireWrite(id);
    const existing = await this.getEndpoint(id);
    if (!existing) {
      return false;
    }

    await this.store.db.deleteFrom("webhook_endpoints").where("id", "=", id).execute();
    // The tags go with the row: a leftover link would later match a reused id.
    await this.access.dropObject(id);
    return true;
  }

  /** An endpoint the caller holds no tag for reads as absent. */
  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    if (!(await this.access.canRead(id))) return null;
    const row = await this.store.db
      .selectFrom("webhook_endpoints")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return this.mapEndpointRow(row as any);
  }

  async listEndpoints(params: WebhookEndpointListParams): Promise<PaginatedResult<WebhookEndpoint>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.filterEndpoints(this.visibleEndpoints(), params)
      .selectAll("obj")
      .orderBy("obj.createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const countResult = await this.filterEndpoints(
      this.visibleEndpoints(),
      params,
    )
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: items.map((row) => this.mapEndpointRow(row as any)),
      totalCount,
    };
  }

  /** Endpoints the caller may see, as the base of every listing and count. */
  private visibleEndpoints() {
    return visibleFrom(this.store.db, "webhook_endpoints");
  }

  private filterEndpoints(query: any, params: WebhookEndpointListParams) {
    let next = query;
    if (params.provider) next = next.where("obj.provider", "=", params.provider);
    if (params.enabled !== undefined) {
      next = next.where("obj.enabled", "=", params.enabled ? 1 : 0);
    }
    return applyKyselyFilter(next, params.filter, endpointFilterSchema);
  }

  /**
   * Deliveries of the endpoints the caller may see.
   *
   * The log carries no tags of its own, so the narrowing is a lookup against
   * the endpoints that do — bodies, headers and IPs of an integration are as
   * private as the integration is.
   */
  private visibleLogs() {
    return (this.store.db.selectFrom("webhook_logs as log") as any).where(
      "log.endpointId",
      "in",
      this.visibleEndpoints().select("obj.id"),
    );
  }

  private filterLogs(query: any, params: WebhookLogListParams) {
    let next = query;
    if (params.endpointId) {
      next = next.where("log.endpointId", "=", params.endpointId);
    }
    if (params.provider) next = next.where("log.provider", "=", params.provider);
    return applyKyselyFilter(next, params.filter, logFilterSchema);
  }

  /**
   * Written by the gateway after a delivery has been answered, with no actor to
   * narrow by — see the note on `access`. It inherits its audience by pointing
   * at its endpoint.
   */
  async createLog(entry: Omit<WebhookLogEntry, "id" | "createdAt">): Promise<WebhookLogEntry> {
    const createdAt = new Date().toISOString();

    const result = await this.store.db
      .insertInto("webhook_logs")
      .values({
        endpointId: entry.endpointId,
        provider: entry.provider,
        method: entry.method,
        path: entry.path,
        headers: entry.headers ? JSON.stringify(entry.headers) : null,
        body: entry.body ?? null,
        ip: entry.ip ?? null,
        status: entry.status ?? null,
        error: entry.error ?? null,
        createdAt,
      })
      .returningAll()
      .executeTakeFirst();

    if (!result) {
      return {
        id: 0,
        createdAt,
        ...entry,
      };
    }

    return this.mapLogRow(result as any);
  }

  async listLogs(params: WebhookLogListParams): Promise<PaginatedResult<WebhookLogEntry>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.filterLogs(this.visibleLogs(), params)
      .selectAll("log")
      .orderBy("log.createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const countResult = await this.filterLogs(this.visibleLogs(), params)
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: items.map((row) => this.mapLogRow(row as any)),
      totalCount,
    };
  }

  async countEndpoints(filter?: Record<string, unknown>): Promise<number> {
    const query = applyKyselyFilter(
      this.visibleEndpoints().select((eb: any) => eb.fn.countAll().as("count")),
      filter,
      endpointFilterSchema,
    );
    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async countLogs(filter?: Record<string, unknown>): Promise<number> {
    const query = applyKyselyFilter(
      this.visibleLogs().select((eb: any) => eb.fn.countAll().as("count")),
      filter,
      logFilterSchema,
    );
    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  private mapEndpointRow(row: any): WebhookEndpoint {
    return {
      id: row.id,
      slug: row.slug ?? row.id,
      name: row.name,
      provider: row.provider,
      topic: row.topic ?? undefined,
      verify: (row.verify ?? "secret") as WebhookVerification,
      params: row.params ? JSON.parse(row.params) : undefined,
      enabled: Boolean(row.enabled ?? 0),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
    };
  }

  private mapLogRow(row: any): WebhookLogEntry {
    return {
      id: Number(row.id),
      endpointId: row.endpointId,
      provider: row.provider,
      method: row.method,
      path: row.path,
      headers: row.headers ? JSON.parse(row.headers) : undefined,
      body: row.body ?? undefined,
      ip: row.ip ?? undefined,
      status: row.status ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.createdAt,
    };
  }
}
