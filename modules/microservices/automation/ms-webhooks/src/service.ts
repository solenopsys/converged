import type {
  WebhooksService,
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

const MS_ID = "webhooks-ms";

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
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  listProviders(): Promise<ProviderDefinition[]> {
    return Promise.resolve(listProviderDefinitions());
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
