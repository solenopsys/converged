// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type Permission = string;

export type GrantMethods = string | { [mode: string]: string[] };

export type GrantTree = {
  [kind: string]: { [service: string]: GrantMethods };
};

export type AccessPreset = {
  name: string;
  permissions: GrantTree;
};

const metadata: ServiceMetadata = {
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
          "type": "GrantTree",
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
      "returnType": "GrantTree",
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
      "returnType": "GrantTree",
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
          "type": "GrantTree",
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
          "type": "GrantTree",
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
      "returnType": "GrantTree | any",
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
      "name": "GrantMethods",
      "kind": "type",
      "definition": "string | { [mode: string]: string[] }"
    },
    {
      "name": "GrantTree",
      "kind": "type",
      "definition": "{\n  [kind: string]: { [service: string]: GrantMethods };\n}"
    },
    {
      "name": "AccessPreset",
      "kind": "type",
      "definition": "{\n  name: string;\n  permissions: GrantTree;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface AccessServiceRtClient {
  emitJWT(userId: string): string;
  issueServiceJWT(serviceName: string, permissions: GrantTree): string;
  addPermissionToUser(userId: string, permission: Permission): void;
  removePermissionFromUser(userId: string, permission: Permission): void;
  getPermissionsFromUser(userId: string): GrantTree;
  getPermissionsMixinFromUser(userId: string): GrantTree;
  linkPresetToUser(userId: string, presetName: string): void;
  unlinkPresetFromUser(userId: string, presetName: string): void;
  createPreset(presetName: string, permissions: GrantTree): void;
  updatePreset(presetName: string, permissions: GrantTree): void;
  deletePreset(presetName: string): void;
  getPreset(presetName: string): GrantTree | any;
  getAllPresets(): AccessPreset[];
}

export function createAccessServiceRtClient(): AccessServiceRtClient {
  return createRtClient<AccessServiceRtClient>(metadata);
}
