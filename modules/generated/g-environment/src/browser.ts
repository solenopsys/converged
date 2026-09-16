// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
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

export type SurfaceLayout = {
	pinned: string[];
	unpinned: string[];
};

export type ScopedLayout = {
	scope: string;
	pinned: string[];
	unpinned: string[];
};

export type UserEnvironment = {
	windows: SavedWindow[];
	commands: CommandLayout;
	surfaces: SurfaceLayout;
	layouts: ScopedLayout[];
	/**
	 * Interface language the user chose, e.g. `ru`; empty until they choose one.
	 * Kept with the account rather than in the console's URL, so it follows the
	 * person to another machine and a reload does not lose it.
	 */
	locale: string;
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
    },
    {
      "name": "saveSurfaceLayout",
      "parameters": [
        {
          "name": "layout",
          "type": "SurfaceLayout",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "UserEnvironment",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveLayout",
      "parameters": [
        {
          "name": "scope",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "layout",
          "type": "SurfaceLayout",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "UserEnvironment",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveLocale",
      "parameters": [
        {
          "name": "locale",
          "type": "string",
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
      "definition": "{\n\tkey: string;\n\tactionId: string;\n\tparams?: Record<string, unknown>;\n\tpinned?: boolean;\n}"
    },
    {
      "name": "CommandLayout",
      "kind": "type",
      "definition": "{\n\tpinned: string[];\n\thidden: string[];\n\torder: string[];\n}"
    },
    {
      "name": "SurfaceLayout",
      "kind": "type",
      "definition": "{\n\tpinned: string[];\n\tunpinned: string[];\n}"
    },
    {
      "name": "ScopedLayout",
      "kind": "type",
      "definition": "{\n\tscope: string;\n\tpinned: string[];\n\tunpinned: string[];\n}"
    },
    {
      "name": "UserEnvironment",
      "kind": "type",
      "definition": "{\n\twindows: SavedWindow[];\n\tcommands: CommandLayout;\n\tsurfaces: SurfaceLayout;\n\tlayouts: ScopedLayout[];\n\t/**\n\t * Interface language the user chose, e.g. `ru`; empty until they choose one.\n\t * Kept with the account rather than in the console's URL, so it follows the\n\t * person to another machine and a reload does not lose it.\n\t */\n\tlocale: string;\n\tupdatedAt: string;\n}"
    }
  ]
};

// Client interface
export interface EnvironmentServiceClient {
  getCurrent(): Promise<UserEnvironment>;
  saveWindows(windows: SavedWindow[]): Promise<UserEnvironment>;
  saveCommandLayout(layout: CommandLayout): Promise<UserEnvironment>;
  saveSurfaceLayout(layout: SurfaceLayout): Promise<UserEnvironment>;
  saveLayout(scope: string, layout: SurfaceLayout): Promise<UserEnvironment>;
  saveLocale(locale: string): Promise<UserEnvironment>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createEnvironmentServiceClient(
  config: WebSocketClientConfig,
): EnvironmentServiceClient {
  return createWebSocketClient<EnvironmentServiceClient>(metadata, config);
}

export function createEnvironmentServiceWebSocketClient(
  config: WebSocketClientConfig,
): EnvironmentServiceClient {
  return createEnvironmentServiceClient(config);
}
