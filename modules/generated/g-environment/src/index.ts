// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type SavedWindow = {
  key: string;
  actionId: string;
  params?: Record<string, unknown>;
  pinned?: boolean;
};

export type CommandLayout = {
  pinned: string[];
  hidden: string[];
  order: string[];
};

export type UserEnvironment = {
  windows: SavedWindow[];
  commands: CommandLayout;
  updatedAt: string;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "EnvironmentService",
  "serviceName": "environment",
  "filePath": "sequrity/environment.ts",
  "methods": [
    {
      "name": "getCurrent",
      "parameters": [],
      "returnType": "UserEnvironment",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveWindows",
      "parameters": [
        {
          "name": "windows",
          "type": "SavedWindow",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "UserEnvironment",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveCommandLayout",
      "parameters": [
        {
          "name": "layout",
          "type": "CommandLayout",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "UserEnvironment",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "SavedWindow",
      "kind": "type",
      "definition": "{\n  key: string;\n  actionId: string;\n  params?: Record<string, unknown>;\n  pinned?: boolean;\n}"
    },
    {
      "name": "CommandLayout",
      "kind": "type",
      "definition": "{\n  pinned: string[];\n  hidden: string[];\n  order: string[];\n}"
    },
    {
      "name": "UserEnvironment",
      "kind": "type",
      "definition": "{\n  windows: SavedWindow[];\n  commands: CommandLayout;\n  updatedAt: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface EnvironmentService {
  getCurrent(): Promise<UserEnvironment>;
  saveWindows(windows: SavedWindow[]): Promise<UserEnvironment>;
  saveCommandLayout(layout: CommandLayout): Promise<UserEnvironment>;
}

// Client interface
export interface EnvironmentServiceClient {
  getCurrent(): Promise<UserEnvironment>;
  saveWindows(windows: SavedWindow[]): Promise<UserEnvironment>;
  saveCommandLayout(layout: CommandLayout): Promise<UserEnvironment>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createEnvironmentServiceClient(
  config: CrullerTransportClientConfig,
): EnvironmentServiceClient {
  return createCrullerTransportClient<EnvironmentServiceClient>(metadata, config);
}

export function createEnvironmentServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): EnvironmentServiceClient {
  return createEnvironmentServiceClient(config);
}
