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

export interface FujinService {
	state(): Promise<FujinState>;
	messages(limit?: number): Promise<FujinMessages>;
	logs(limit?: number): AsyncIterable<FujinMessages>;
}
