// Auto-generated package
import { createHttpClient } from "nrpc";

export type Permission = string;

export interface AccessPreset {
  name: string;
  permissions: Permission[];
}

export const metadata = {
  "interfaceName": "AccessService",
  "serviceName": "access",
  "filePath": "../types/access.ts",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getAllPresets",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "Permission",
      "definition": "string"
    },
    {
      "name": "AccessPreset",
      "definition": "",
      "properties": [
        {
          "name": "name",
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
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface AccessService {
  emitJWT(userId: string): Promise<any>;
  addPermissionToUser(userId: string, permission: Permission): Promise<any>;
  removePermissionFromUser(userId: string, permission: Permission): Promise<any>;
  getPermissionsFromUser(userId: string): Promise<any>;
  getPermissionsMixinFromUser(userId: string): Promise<any>;
  linkPresetToUser(userId: string, presetName: string): Promise<any>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<any>;
  createPreset(presetName: string, permissions: Permission[]): Promise<any>;
  updatePreset(presetName: string, permissions: Permission[]): Promise<any>;
  deletePreset(presetName: string): Promise<any>;
  getPreset(presetName: string): Promise<any>;
  getAllPresets(): Promise<any>;
}

// Client interface
export interface AccessServiceClient {
  emitJWT(userId: string): Promise<any>;
  addPermissionToUser(userId: string, permission: Permission): Promise<any>;
  removePermissionFromUser(userId: string, permission: Permission): Promise<any>;
  getPermissionsFromUser(userId: string): Promise<any>;
  getPermissionsMixinFromUser(userId: string): Promise<any>;
  linkPresetToUser(userId: string, presetName: string): Promise<any>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<any>;
  createPreset(presetName: string, permissions: Permission[]): Promise<any>;
  updatePreset(presetName: string, permissions: Permission[]): Promise<any>;
  deletePreset(presetName: string): Promise<any>;
  getPreset(presetName: string): Promise<any>;
  getAllPresets(): Promise<any>;
}

// Factory function
export function createAccessServiceClient(
  config?: { baseUrl?: string },
): AccessServiceClient {
  return createHttpClient<AccessServiceClient>(metadata, config);
}

// Ready-to-use client
export const accessClient = createAccessServiceClient();
