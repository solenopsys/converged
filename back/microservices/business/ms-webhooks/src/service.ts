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
} from "./types";
import { StoresController } from "./stores";
import { getProviderDefinition, listProviderDefinitions } from "./providers";

const MS_ID = "webhooks-ms";

export class WebhooksServiceImpl implements WebhooksService {
  private stores!: StoresController;

  constructor() {
    this.init();
  }

  async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
  }

  listProviders(): Promise<ProviderDefinition[]> {
    return Promise.resolve(listProviderDefinitions());
  }

  async createEndpoint(input: WebhookEndpointInput): Promise<{ id: string }> {
    this.assertInput(input);
    const endpoint = await this.stores.webhooks.createEndpoint(input);
    return { id: endpoint.id };
  }

  async updateEndpoint(
    id: string,
    updates: WebhookEndpointUpdate,
  ): Promise<WebhookEndpoint | null> {
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

  deleteEndpoint(id: string): Promise<boolean> {
    if (!id) {
      const error: any = new Error("id is required");
      error.statusCode = 400;
      throw error;
    }
    return this.stores.webhooks.deleteEndpoint(id);
  }

  getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    if (!id) {
      const error: any = new Error("id is required");
      error.statusCode = 400;
      throw error;
    }
    return this.stores.webhooks.getEndpoint(id);
  }

  listEndpoints(params: WebhookEndpointListParams): Promise<PaginatedResult<WebhookEndpoint>> {
    return this.stores.webhooks.listEndpoints(params);
  }

  listLogs(params: WebhookLogListParams): Promise<PaginatedResult<WebhookLogEntry>> {
    return this.stores.webhooks.listLogs(params);
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
