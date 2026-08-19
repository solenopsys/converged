export type FujinClientState = {
  id: number;
  scope: string;
};

export type FujinState = {
  websocketClients: FujinClientState[];
  peers: unknown;
};

export type FujinMessage = Record<string, unknown>;

export type FujinMessages = {
  stored: number;
  recorded: number;
  messages: FujinMessage[];
};

/** Browser/CLI administration API owned by the Fujin native process. */
export interface RuntimeFujinService {
  state(): Promise<FujinState>;
  messages(limit?: number): Promise<FujinMessages>;
  logs(limit?: number): AsyncIterable<FujinMessages>;
}
