import { type Provider, ProviderState } from "../dag-api";
import { createAuthServiceClient, type AuthServiceClient } from "g-auth";

export default class AuthProvider implements Provider {
  readonly name = "auth";
  private _state: ProviderState = ProviderState.STOPPED;
  private client: AuthServiceClient;

  constructor(host: string) {
    this.client = createAuthServiceClient({ baseUrl: host });
    this._state = ProviderState.READY;
  }

  get state(): ProviderState { return this._state; }
  async start(): Promise<void> { this._state = ProviderState.READY; }
  async stop(): Promise<void> { this._state = ProviderState.STOPPED; }
  isReady(): boolean { return this._state === ProviderState.READY; }

  async invoke(operation: string, params: any): Promise<any> {
    if (!this.isReady()) throw new Error(`AuthProvider not ready (state: ${this._state})`);

    if (operation === "getMagicLink") return this.client.getMagicLink(params.email, params.returnTo);

    throw new Error(`AuthProvider: unknown operation "${operation}"`);
  }
}
