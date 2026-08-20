// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type Permission = string;

export type AccessPreset = {
  name: string;
  permissions: Permission[];
};

export const metadata: ServiceMetadata = {
  "interfaceName": "AccessService",
  "serviceName": "access",
  "filePath": "sequrity/access.ts",
  "methods": [
    {
      "name": "emitJWT",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
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
      "name": "issueServiceJWT",
      "parameters": [
        {
          "name": "serviceName",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "permissions",
          "type": "Permission",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "addPermissionToUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "permission",
          "type": "Permission",
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
      "name": "removePermissionFromUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "permission",
          "type": "Permission",
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
      "name": "getPermissionsFromUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Permission",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getPermissionsMixinFromUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Permission",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "linkPresetToUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "presetName",
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
      "name": "unlinkPresetFromUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "presetName",
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
      "name": "createPreset",
      "parameters": [
        {
          "name": "presetName",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "permissions",
          "type": "Permission",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updatePreset",
      "parameters": [
        {
          "name": "presetName",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "permissions",
          "type": "Permission",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deletePreset",
      "parameters": [
        {
          "name": "presetName",
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
      "name": "getPreset",
      "parameters": [
        {
          "name": "presetName",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Permission | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getAllPresets",
      "parameters": [],
      "returnType": "AccessPreset",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "Permission",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "AccessPreset",
      "kind": "type",
      "definition": "{\n  name: string;\n  permissions: Permission[];\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface AccessService {
  emitJWT(userId: string): Promise<string>;
  issueServiceJWT(serviceName: string, permissions: Permission[]): Promise<string>;
  addPermissionToUser(userId: string, permission: Permission): Promise<void>;
  removePermissionFromUser(userId: string, permission: Permission): Promise<void>;
  getPermissionsFromUser(userId: string): Promise<Permission[]>;
  getPermissionsMixinFromUser(userId: string): Promise<Permission[]>;
  linkPresetToUser(userId: string, presetName: string): Promise<void>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<void>;
  createPreset(presetName: string, permissions: Permission[]): Promise<void>;
  updatePreset(presetName: string, permissions: Permission[]): Promise<void>;
  deletePreset(presetName: string): Promise<void>;
  getPreset(presetName: string): Promise<Permission | any>;
  getAllPresets(): Promise<AccessPreset[]>;
}

// Client interface
export interface AccessServiceClient {
  emitJWT(userId: string): Promise<string>;
  issueServiceJWT(serviceName: string, permissions: Permission[]): Promise<string>;
  addPermissionToUser(userId: string, permission: Permission): Promise<void>;
  removePermissionFromUser(userId: string, permission: Permission): Promise<void>;
  getPermissionsFromUser(userId: string): Promise<Permission[]>;
  getPermissionsMixinFromUser(userId: string): Promise<Permission[]>;
  linkPresetToUser(userId: string, presetName: string): Promise<void>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<void>;
  createPreset(presetName: string, permissions: Permission[]): Promise<void>;
  updatePreset(presetName: string, permissions: Permission[]): Promise<void>;
  deletePreset(presetName: string): Promise<void>;
  getPreset(presetName: string): Promise<Permission | any>;
  getAllPresets(): Promise<AccessPreset[]>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createAccessServiceClient(
  config: CrullerTransportClientConfig,
): AccessServiceClient {
  return createCrullerTransportClient<AccessServiceClient>(metadata, config);
}

export function createAccessServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): AccessServiceClient {
  return createAccessServiceClient(config);
}
