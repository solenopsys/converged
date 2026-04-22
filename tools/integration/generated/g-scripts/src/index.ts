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
  "interfaceName": "ScriptsService",
  "serviceName": "scripts",
  "filePath": "services/content/scripts.ts",
  "methods": [
    {
      "name": "saveScript",
      "parameters": [
        {
          "name": "file",
          "type": "ScriptFile",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "readScript",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ScriptFile",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteScript",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listScripts",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ScriptListResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getHash",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ScriptHashResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getHashMap",
      "parameters": [],
      "returnType": "ScriptHashMap",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ScriptFile",
      "kind": "type",
      "definition": "{\n\tpath: string;\n\tcontent: string;\n}"
    },
    {
      "name": "ScriptListItem",
      "kind": "type",
      "definition": "{\n\tpath: string;\n\thash: string;\n}"
    },
    {
      "name": "ScriptListResult",
      "kind": "type",
      "definition": "{\n\titems: ScriptListItem[];\n\ttotalCount?: number;\n}"
    },
    {
      "name": "ScriptHashResult",
      "kind": "type",
      "definition": "{\n\thash?: string;\n}"
    },
    {
      "name": "ScriptHashMap",
      "kind": "type",
      "definition": "{\n\t[path: string]: string;\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n}"
    }
  ]
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
export function createScriptsServiceClient(
  config?: { baseUrl?: string },
): ScriptsServiceClient {
  return createHttpClient<ScriptsServiceClient>(metadata, config);
}

// Ready-to-use client
export const scriptsClient = createScriptsServiceClient();
