import { type Provider, ProviderState } from "../dag-api";
import {
  createOpenScadConvertorServiceClient,
  type OpenScadConvertInput,
  type OpenScadConvertResult,
  type OpenScadConvertorServiceClient,
} from "g-openscadconvertor";

interface ConvertParams {
  input: OpenScadConvertInput;
}

export default class OpenScadConvertorProvider implements Provider {
  readonly name = "openscadconvertor";
  private _state: ProviderState = ProviderState.STOPPED;
  private client: OpenScadConvertorServiceClient;

  constructor(host: string) {
    this._state = ProviderState.STARTING;
    this.client = createOpenScadConvertorServiceClient({ baseUrl: host });
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

  async invoke(
    operation: string,
    params: ConvertParams,
  ): Promise<OpenScadConvertResult> {
    if (!this.isReady()) {
      throw new Error(`Provider is not ready (state: ${this._state})`);
    }

    if (operation !== "convert") {
      throw new Error(`Unknown operation: ${operation}`);
    }

    try {
      return await this.client.convert(params.input);
    } catch (error: any) {
      this._state = ProviderState.ERROR;
      throw new Error(`OpenScadConvertor convert failed: ${error.message}`);
    }
  }
}
