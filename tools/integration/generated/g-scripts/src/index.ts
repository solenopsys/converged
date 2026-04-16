// Auto-generated package
import { createHttpClient } from "nrpc";

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

export const metadata = {
	interfaceName: "ScriptsService",
	serviceName: "scripts",
	filePath: "../types/scripts.ts",
	methods: [
		{
			name: "saveScript",
			parameters: [
				{
					name: "file",
					type: "ScriptFile",
					optional: false,
					isArray: false,
				},
			],
			returnType: "string",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "readScript",
			parameters: [
				{
					name: "path",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "ScriptFile",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "deleteScript",
			parameters: [
				{
					name: "path",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "void",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listScripts",
			parameters: [
				{
					name: "params",
					type: "PaginationParams",
					optional: false,
					isArray: false,
				},
			],
			returnType: "ScriptListResult",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getHash",
			parameters: [
				{
					name: "path",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "ScriptHashResult",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getHashMap",
			parameters: [],
			returnType: "ScriptHashMap",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
	],
	types: [
		{
			name: "ScriptFile",
			definition: "{\n  path: string;\n  content: string;\n}",
		},
		{
			name: "ScriptListItem",
			definition: "{\n  path: string;\n  hash: string;\n}",
		},
		{
			name: "ScriptListResult",
			definition: "{\n  items: ScriptListItem[];\n  totalCount?: number;\n}",
		},
		{
			name: "ScriptHashResult",
			definition: "{\n  hash?: string;\n}",
		},
		{
			name: "ScriptHashMap",
			definition: "{\n  [path: string]: string;\n}",
		},
		{
			name: "PaginationParams",
			definition: "{\n  offset: number;\n  limit: number;\n}",
		},
	],
};

// Server interface (to be implemented in microservice)
export interface ScriptsService {
	saveScript(file: ScriptFile): Promise<string>;
	readScript(path: string): Promise<ScriptFile>;
	deleteScript(path: string): Promise<void>;
	listScripts(params: PaginationParams): Promise<ScriptListResult>;
	getHash(path: string): Promise<ScriptHashResult>;
	getHashMap(): Promise<ScriptHashMap>;
}

// Client interface
export interface ScriptsServiceClient {
	saveScript(file: ScriptFile): Promise<string>;
	readScript(path: string): Promise<ScriptFile>;
	deleteScript(path: string): Promise<void>;
	listScripts(params: PaginationParams): Promise<ScriptListResult>;
	getHash(path: string): Promise<ScriptHashResult>;
	getHashMap(): Promise<ScriptHashMap>;
}

// Factory function
export function createScriptsServiceClient(config?: {
	baseUrl?: string;
}): ScriptsServiceClient {
	return createHttpClient<ScriptsServiceClient>(metadata, config);
}

// Ready-to-use client
export const scriptsClient = createScriptsServiceClient();
