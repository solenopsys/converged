// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface EnvironmentServiceRtClient {
  getCurrent(): UserEnvironment;
  saveWindows(windows: SavedWindow[]): UserEnvironment;
  saveCommandLayout(layout: CommandLayout): UserEnvironment;
}

export function createEnvironmentServiceRtClient(): EnvironmentServiceRtClient {
  return createRtClient<EnvironmentServiceRtClient>(metadata);
}
