export type ScriptFile = {
	path: string;
	content: string;
};

export type ScriptListItem = {
	path: string;
	hash: string;
};

export type ScriptListResult = {
	items: ScriptListItem[];
	totalCount?: number;
};

export type ScriptHashResult = {
	hash?: string;
};

export type ScriptHashMap = {
	[path: string]: string;
};

export type PaginationParams = {
	offset: number;
	limit: number;
};

export interface ScriptsService {
	saveScript(file: ScriptFile): Promise<string>;
	readScript(path: string): Promise<ScriptFile>;
	deleteScript(path: string): Promise<void>;
	listScripts(params: PaginationParams): Promise<ScriptListResult>;
	getHash(path: string): Promise<ScriptHashResult>;
	getHashMap(): Promise<ScriptHashMap>;
}
