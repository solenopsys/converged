import type {
  WebhooksService,
  WebhookDelivery,
  WebhookResolution,
  WebhookEndpoint,
  WebhookEndpointInput,
  WebhookEndpointUpdate,
  WebhookEndpointListParams,
  WebhookLogEntry,
  WebhookLogListParams,
  PaginatedResult,
  ProviderDefinition,
  FilterObject,
  SelectionDescriptor,
  SelectionStats,
} from "./types";
import { StoresController } from "./stores";
import { getProviderDefinition, listProviderDefinitions } from "./providers";

const REPOSITORY_ID = "rp-webhooks";

export class WebhooksServiceImpl implements WebhooksService {
  private stores!: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(REPOSITORY_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  listProviders(): Promise<ProviderDefinition[]> {
    return Promise.resolve(listProviderDefinitions());
  }

  /**
   * Everything the UI gateway needs to accept one delivery: the topic to
   * publish under and the secret to check it against. A disabled endpoint is
   * still returned — the gateway refuses it and logs why, which is far easier
   * to diagnose than a 404 on a URL that plainly exists.
   */
  async resolveEndpoint(slug: string): Promise<WebhookResolution | null> {
    await this.init();
    if (!slug) return null;
    const endpoint = await this.stores.webhooks.getEndpointBySlug(slug);
    if (!endpoint) return null;

    const secret = endpoint.params?.secret;
    return {
      id: endpoint.id,
      slug: endpoint.slug,
      provider: endpoint.provider,
      topic: endpoint.topic?.trim() || `webhook.${endpoint.provider}.${endpoint.slug}`,
      verify: endpoint.verify,
      secret: typeof secret === "string" && secret ? secret : undefined,
      enabled: endpoint.enabled,
    };
  }

  /**
   * The delivery log. Written after the answer has gone back to the producer,
   * so a slow write costs nothing at the edge; a failure here must never turn
   * an accepted delivery into a retry storm, so it is logged and swallowed.
   */
  async recordDelivery(delivery: WebhookDelivery): Promise<void> {
    await this.init();
    try {
      await this.stores.webhooks.createLog(delivery);
    } catch (error) {
      console.error("[rp-webhooks] delivery log failed", error);
    }
  }

  async createEndpoint(input: WebhookEndpointInput): Promise<{ id: string }> {
    await this.init();
    this.assertInput(input);
    const endpoint = await this.stores.webhooks.createEndpoint(input);
    return { id: endpoint.id };
  }

  async updateEndpoint(
    id: string,
    updates: WebhookEndpointUpdate,
  ): Promise<WebhookEndpoint | null> {
    await this.init();
    if (!id) {
      const error: any = new Error("id is required");
      error.statusCode = 400;
      throw error;
    }

    if (updates.provider) {
      this.assertProvider(updates.provider);
    }

    return await this.stores.webhooks.updateEndpoint(id, updates);
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    await this.init();
    if (!id) {
      const error: any = new Error("id is required");
      error.statusCode = 400;
      throw error;
    }
    return this.stores.webhooks.deleteEndpoint(id);
  }

  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    await this.init();
    if (!id) {
      const error: any = new Error("id is required");
      error.statusCode = 400;
      throw error;
    }
    return this.stores.webhooks.getEndpoint(id);
  }

  async listEndpoints(params: WebhookEndpointListParams): Promise<PaginatedResult<WebhookEndpoint>> {
    await this.init();
    return this.stores.webhooks.listEndpoints(params);
  }

  async listLogs(params: WebhookLogListParams): Promise<PaginatedResult<WebhookLogEntry>> {
    await this.init();
    return this.stores.webhooks.listLogs(params);
  }

  async describeSelection(objectType: string): Promise<SelectionDescriptor> {
    if (objectType === "webhooks.endpoint") {
      return { objectType, title: "Webhook endpoints", fields: [
        { id: "name", label: "Name", valueType: "string", operators: ["eq", "in", "contains", "startsWith"] },
        { id: "provider", label: "Provider", valueType: "enum", operators: ["eq", "in", "notEq", "notIn"] },
        { id: "enabled", label: "Enabled", valueType: "boolean", operators: ["eq", "notEq"] },
      ], revision: "webhooks-v1" };
    }
    if (objectType === "webhooks.log") {
      return { objectType, title: "Webhook logs", fields: [
        { id: "endpointId", label: "Endpoint", valueType: "string", operators: ["eq", "in", "notEq", "notIn"] },
        { id: "provider", label: "Provider", valueType: "enum", operators: ["eq", "in", "notEq", "notIn"] },
        { id: "status", label: "Status", valueType: "number", operators: ["eq", "in", "gt", "gte", "lt", "lte", "between", "isNull"] },
        { id: "createdAt", label: "Created", valueType: "date", operators: ["gt", "gte", "lt", "lte", "between"] },
      ], revision: "webhooks-v1" };
    }
    throw new Error(`Unsupported webhooks selection object: ${objectType}`);
  }

  async inspectEndpoints(filter?: FilterObject): Promise<SelectionStats> {
    await this.init();
    return { totalCount: await this.stores.webhooks.countEndpoints(filter) };
  }

  async inspectLogs(filter?: FilterObject): Promise<SelectionStats> {
    await this.init();
    return { totalCount: await this.stores.webhooks.countLogs(filter) };
  }

  private assertInput(input: WebhookEndpointInput) {
    if (!input?.name || !input?.provider) {
      const error: any = new Error("name and provider are required");
      error.statusCode = 400;
      throw error;
    }

    this.assertProvider(input.provider);
  }

  private assertProvider(code: string) {
    const provider = getProviderDefinition(code);
    if (!provider) {
      const error: any = new Error(`Unknown provider: ${code}`);
      error.statusCode = 400;
      throw error;
    }
  }
}

export default WebhooksServiceImpl;
