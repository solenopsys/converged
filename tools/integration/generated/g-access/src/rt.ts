// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type Permission = string;

export type AccessPreset = {
  name: string;
  permissions: Permission[];
};

const metadata: ServiceMetadata = {
  "interfaceName": "AccessService",
  "serviceName": "access",
  "filePath": "services/sequrity/access.ts",
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface AccessServiceRtClient {
  emitJWT(userId: string): string;
  addPermissionToUser(userId: string, permission: Permission): void;
  removePermissionFromUser(userId: string, permission: Permission): void;
  getPermissionsFromUser(userId: string): Permission[];
  getPermissionsMixinFromUser(userId: string): Permission[];
  linkPresetToUser(userId: string, presetName: string): void;
  unlinkPresetFromUser(userId: string, presetName: string): void;
  createPreset(presetName: string, permissions: Permission[]): void;
  updatePreset(presetName: string, permissions: Permission[]): void;
  deletePreset(presetName: string): void;
  getPreset(presetName: string): Permission | any;
  getAllPresets(): AccessPreset[];
}

export function createAccessServiceRtClient(): AccessServiceRtClient {
  return createRtClient<AccessServiceRtClient>(metadata);
}
