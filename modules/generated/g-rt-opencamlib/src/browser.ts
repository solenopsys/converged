// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type CacheRef = {
  cacheKey: string;
  sizeBytes: number;
};

export type OpencamlibTask = {
  stlPath?: string;
  gcodePath?: string;
  toolDiameter?: number;
  toolLength?: number;
  stepover?: number;
  sampling?: number;
  minSampling?: number;
  feed?: number;
  rapid?: number;
  safeZ?: number;
};

export type OpencamlibResult = {
  triangles: number;
  passes: number;
  points: number;
  totalTimeSec: number;
  gcodePath?: string;
  gcodeBytes?: number;
};

export type OpencamlibRequest = {
  task: OpencamlibTask;
  /** task field -> Valkey cacheKey to stage into a temp file. */
  inputs?: Record<string, string>;
  /** task fields written as files, returned as cache refs. */
  outputs?: string[];
  /** Opt into progress chunks on a server-stream; unary callers omit it. */
  stream?: boolean;
};

export type OpencamlibReply = {
  result: OpencamlibResult;
  outputs: Record<string, CacheRef>;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "RuntimeOpencamlibService",
  "serviceName": "opencamlib",
  "filePath": "opencamlib.ts",
  "methods": [
    {
      "name": "analyze",
      "parameters": [
        {
          "name": "request",
          "type": "OpencamlibRequest",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "OpencamlibReply",
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
      "name": "OpencamlibTask",
      "kind": "type",
      "definition": "{\n  stlPath?: string;\n  gcodePath?: string;\n  toolDiameter?: number;\n  toolLength?: number;\n  stepover?: number;\n  sampling?: number;\n  minSampling?: number;\n  feed?: number;\n  rapid?: number;\n  safeZ?: number;\n}"
    },
    {
      "name": "OpencamlibResult",
      "kind": "type",
      "definition": "{\n  triangles: number;\n  passes: number;\n  points: number;\n  totalTimeSec: number;\n  gcodePath?: string;\n  gcodeBytes?: number;\n}"
    },
    {
      "name": "OpencamlibRequest",
      "kind": "type",
      "definition": "{\n  task: OpencamlibTask;\n  /** task field -> Valkey cacheKey to stage into a temp file. */\n  inputs?: Record<string, string>;\n  /** task fields written as files, returned as cache refs. */\n  outputs?: string[];\n  /** Opt into progress chunks on a server-stream; unary callers omit it. */\n  stream?: boolean;\n}"
    },
    {
      "name": "OpencamlibReply",
      "kind": "type",
      "definition": "{\n  result: OpencamlibResult;\n  outputs: Record<string, CacheRef>;\n}"
    }
  ]
};

// Client interface
export interface RuntimeOpencamlibServiceClient {
  analyze(request: OpencamlibRequest): Promise<OpencamlibReply>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createRuntimeOpencamlibServiceClient(
  config: WebSocketClientConfig,
): RuntimeOpencamlibServiceClient {
  return createWebSocketClient<RuntimeOpencamlibServiceClient>(metadata, config);
}

export function createRuntimeOpencamlibServiceWebSocketClient(
  config: WebSocketClientConfig,
): RuntimeOpencamlibServiceClient {
  return createRuntimeOpencamlibServiceClient(config);
}
