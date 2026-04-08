import { type Provider, ProviderState } from "../dag-api";
import { createNotifyServiceClient, type NotifyServiceClient, type NotifySendInput } from "g-notify";

export default class NotifyProvider implements Provider {
  readonly name = "notify";
  private _state: ProviderState = ProviderState.STOPPED;
  private client: NotifyServiceClient;

  constructor(host: string) {
    this.client = createNotifyServiceClient({ baseUrl: host });
    this._state = ProviderState.READY;
  }

  get state(): ProviderState { return this._state; }
  async start(): Promise<void> { this._state = ProviderState.READY; }
  async stop(): Promise<void> { this._state = ProviderState.STOPPED; }
  isReady(): boolean { return this._state === ProviderState.READY; }

  async invoke(operation: string, params: any): Promise<any> {
    if (!this.isReady()) throw new Error(`NotifyProvider not ready (state: ${this._state})`);

    if (operation === "send") return this.client.send(params as NotifySendInput);
    if (operation === "recordSend") return this.client.recordSend(params as NotifySendInput);
    if (operation === "listSends") return this.client.listSends();
    if (operation === "saveChannel") return this.client.saveChannel(params);
    if (operation === "listChannels") return this.client.listChannels();

    throw new Error(`NotifyProvider: unknown operation "${operation}"`);
  }
}
