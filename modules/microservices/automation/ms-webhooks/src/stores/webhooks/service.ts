import { SqlStore, generateULID } from "back-core";
import type {
  WebhookEndpoint,
  WebhookEndpointInput,
  WebhookEndpointUpdate,
  WebhookEndpointListParams,
  WebhookLogEntry,
  WebhookLogListParams,
  PaginatedResult,
} from "../../types";

export class WebhooksStoreService {
  constructor(private store: SqlStore) {}

  async createEndpoint(input: WebhookEndpointInput): Promise<WebhookEndpoint> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    const enabled = input.enabled ?? true;

    await this.store.db
      .insertInto("webhook_endpoints")
      .values({
        id,
        name: input.name,
        provider: input.provider,
        params: input.params ? JSON.stringify(input.params) : null,
        enabled: enabled ? 1 : 0,
        createdAt,
        updatedAt: createdAt,
      })
      .execute();

    return {
      id,
      name: input.name,
      provider: input.provider,
      params: input.params,
      enabled,
      createdAt,
      updatedAt: createdAt,
    };
  }

  async updateEndpoint(id: string, updates: WebhookEndpointUpdate): Promise<WebhookEndpoint | null> {
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
        name: next.name,
        provider: next.provider,
        params: next.params ? JSON.stringify(next.params) : null,
        enabled: next.enabled ? 1 : 0,
        updatedAt,
      })
      .where("id", "=", id)
      .execute();

    return next;
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    const existing = await this.getEndpoint(id);
    if (!existing) {
      return false;
    }

    await this.store.db.deleteFrom("webhook_endpoints").where("id", "=", id).execute();
    return true;
  }

  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
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

    let query = this.store.db
      .selectFrom("webhook_endpoints")
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset);

    if (params.provider) {
      query = query.where("provider", "=", params.provider);
    }

    if (params.enabled !== undefined) {
      query = query.where("enabled", "=", params.enabled ? 1 : 0);
    }

    const items = await query.execute();

    let countQuery = this.store.db
      .selectFrom("webhook_endpoints")
      .select(({ fn }) => fn.countAll().as("count"));

    if (params.provider) {
      countQuery = countQuery.where("provider", "=", params.provider);
    }
    if (params.enabled !== undefined) {
      countQuery = countQuery.where("enabled", "=", params.enabled ? 1 : 0);
    }

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: items.map((row) => this.mapEndpointRow(row as any)),
      totalCount,
    };
  }

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

    let query = this.store.db
      .selectFrom("webhook_logs")
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset);

    if (params.endpointId) {
      query = query.where("endpointId", "=", params.endpointId);
    }

    if (params.provider) {
      query = query.where("provider", "=", params.provider);
    }

    const items = await query.execute();

    let countQuery = this.store.db
      .selectFrom("webhook_logs")
      .select(({ fn }) => fn.countAll().as("count"));

    if (params.endpointId) {
      countQuery = countQuery.where("endpointId", "=", params.endpointId);
    }
    if (params.provider) {
      countQuery = countQuery.where("provider", "=", params.provider);
    }

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: items.map((row) => this.mapLogRow(row as any)),
      totalCount,
    };
  }

  private mapEndpointRow(row: any): WebhookEndpoint {
    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
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
