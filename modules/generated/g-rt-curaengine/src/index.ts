// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type CacheRef = {
  cacheKey: string;
  sizeBytes: number;
};

export type CuraengineTask = {
  stlPath?: string;
  definitionPath?: string;
  gcodePath?: string;
  modelName?: string;
  definitionName?: string;
  enginePath?: string;
  settings?: string[];
  searchFiles?: { name: string; path: string }[];
  threads?: number;
};

export type CuraengineResult = {
  gcodePath: string;
  gcodeBytes: number;
  exitCode: number;
};

export type CuraengineRequest = {
  task: CuraengineTask;
  /** task field -> Valkey cacheKey to stage into a temp file. */
  inputs?: Record<string, string>;
  /** task fields written as files, returned as cache refs. */
  outputs?: string[];
  /** Opt into progress chunks on a server-stream; unary callers omit it. */
  stream?: boolean;
};

export type CuraengineReply = {
  result: CuraengineResult;
  outputs: Record<string, CacheRef>;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "RuntimeCuraengineService",
  "serviceName": "curaengine",
  "filePath": "curaengine.ts",
  "methods": [
    {
      "name": "analyze",
      "parameters": [
        {
          "name": "request",
          "type": "CuraengineRequest",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CuraengineReply",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "CacheRef",
      "kind": "type",
      "definition": "{\n  cacheKey: string;\n  sizeBytes: number;\n}"
    },
    {
      "name": "CuraengineTask",
      "kind": "type",
      "definition": "{\n  stlPath?: string;\n  definitionPath?: string;\n  gcodePath?: string;\n  modelName?: string;\n  definitionName?: string;\n  enginePath?: string;\n  settings?: string[];\n  searchFiles?: { name: string; path: string }[];\n  threads?: number;\n}"
    },
    {
      "name": "CuraengineResult",
      "kind": "type",
      "definition": "{\n  gcodePath: string;\n  gcodeBytes: number;\n  exitCode: number;\n}"
    },
    {
      "name": "CuraengineRequest",
      "kind": "type",
      "definition": "{\n  task: CuraengineTask;\n  /** task field -> Valkey cacheKey to stage into a temp file. */\n  inputs?: Record<string, string>;\n  /** task fields written as files, returned as cache refs. */\n  outputs?: string[];\n  /** Opt into progress chunks on a server-stream; unary callers omit it. */\n  stream?: boolean;\n}"
    },
    {
      "name": "CuraengineReply",
      "kind": "type",
      "definition": "{\n  result: CuraengineResult;\n  outputs: Record<string, CacheRef>;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface RuntimeCuraengineService {
  analyze(request: CuraengineRequest): Promise<CuraengineReply>;
}

// Client interface
export interface RuntimeCuraengineServiceClient {
  analyze(request: CuraengineRequest): Promise<CuraengineReply>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createRuntimeCuraengineServiceClient(
  config: CrullerTransportClientConfig,
): RuntimeCuraengineServiceClient {
  return createCrullerTransportClient<RuntimeCuraengineServiceClient>(metadata, config);
}

export function createRuntimeCuraengineServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): RuntimeCuraengineServiceClient {
  return createRuntimeCuraengineServiceClient(config);
}
