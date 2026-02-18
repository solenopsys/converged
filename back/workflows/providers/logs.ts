import { type Provider, ProviderState } from "../dag-api";
import {
  createLogsServiceClient,
  type LogsServiceClient,
  type LogEventInput,
  type LogQueryParams,
  type PaginatedResult,
  type LogEvent,
} from "g-logs";

interface WriteParams {
  event: LogEventInput;
}

interface ListHotParams {
  params: LogQueryParams;
}

export default class LogsProvider implements Provider {
  readonly name = "logs";
  private _state: ProviderState = ProviderState.STOPPED;
  private client: LogsServiceClient;

  constructor(host: string) {
    this._state = ProviderState.STARTING;
    this.client = createLogsServiceClient({ baseUrl: host });
    this._state = ProviderState.READY;
  }

  get state(): ProviderState {
    return this._state;
  }

  async start(): Promise<void> {
    if (this._state === ProviderState.STOPPED) {
      this._state = ProviderState.READY;
    }
  }

  async stop(): Promise<void> {
    this._state = ProviderState.STOPPED;
  }

  isReady(): boolean {
    return this._state === ProviderState.READY;
  }

  async invoke(operation: string, params: WriteParams | ListHotParams): Promise<void | PaginatedResult<LogEvent>> {
    if (!this.isReady()) {
      throw new Error(`Provider is not ready (state: ${this._state})`);
    }

    if (operation === "write") {
      return await this.write((params as WriteParams).event);
    }

    if (operation === "listHot") {
      return await this.listHot((params as ListHotParams).params);
    }

    throw new Error(`Unknown operation: ${operation}`);
  }

  async write(event: LogEventInput): Promise<void> {
    if (!this.isReady()) {
      throw new Error(`Provider is not ready (state: ${this._state})`);
    }

    try {
      await this.client.write(event);
    } catch (error: any) {
      this._state = ProviderState.ERROR;
      throw new Error(`Logs write failed: ${error.message}`);
    }
  }

  async listHot(params: LogQueryParams): Promise<PaginatedResult<LogEvent>> {
    if (!this.isReady()) {
      throw new Error(`Provider is not ready (state: ${this._state})`);
    }

    try {
      return await this.client.listHot(params);
    } catch (error: any) {
      this._state = ProviderState.ERROR;
      throw new Error(`Logs listHot failed: ${error.message}`);
    }
  }
}
