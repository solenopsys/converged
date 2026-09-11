// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type Permission = string;

export type GrantMethods = string | { [method: string]: string };

export type GrantTree = {
  [kind: string]: { [service: string]: GrantMethods };
};

export type AccessPreset = {
  name: string;
  permissions: GrantTree;
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
      "name": "addTagToUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "tag",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "mode",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "removeTagFromUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "tag",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "mode",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getTagsOfUser",
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
      "definition": "string | { [method: string]: string }"
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

// Server interface (to be implemented in microservice)
export interface AccessService {
  emitJWT(userId: string): Promise<string>;
  issueServiceJWT(serviceName: string, permissions: GrantTree): Promise<string>;
  addPermissionToUser(userId: string, permission: Permission): Promise<void>;
  removePermissionFromUser(userId: string, permission: Permission): Promise<void>;
  getPermissionsFromUser(userId: string): Promise<GrantTree>;
  getPermissionsMixinFromUser(userId: string): Promise<GrantTree>;
  addTagToUser(userId: string, tag: string, mode?: string): Promise<void>;
  removeTagFromUser(userId: string, tag: string, mode?: string): Promise<void>;
  getTagsOfUser(userId: string): Promise<string[]>;
  linkPresetToUser(userId: string, presetName: string): Promise<void>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<void>;
  createPreset(presetName: string, permissions: GrantTree): Promise<void>;
  updatePreset(presetName: string, permissions: GrantTree): Promise<void>;
  deletePreset(presetName: string): Promise<void>;
  getPreset(presetName: string): Promise<GrantTree | any>;
  getAllPresets(): Promise<AccessPreset[]>;
}

// Client interface
export interface AccessServiceClient {
  emitJWT(userId: string): Promise<string>;
  issueServiceJWT(serviceName: string, permissions: GrantTree): Promise<string>;
  addPermissionToUser(userId: string, permission: Permission): Promise<void>;
  removePermissionFromUser(userId: string, permission: Permission): Promise<void>;
  getPermissionsFromUser(userId: string): Promise<GrantTree>;
  getPermissionsMixinFromUser(userId: string): Promise<GrantTree>;
  addTagToUser(userId: string, tag: string, mode?: string): Promise<void>;
  removeTagFromUser(userId: string, tag: string, mode?: string): Promise<void>;
  getTagsOfUser(userId: string): Promise<string[]>;
  linkPresetToUser(userId: string, presetName: string): Promise<void>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<void>;
  createPreset(presetName: string, permissions: GrantTree): Promise<void>;
  updatePreset(presetName: string, permissions: GrantTree): Promise<void>;
  deletePreset(presetName: string): Promise<void>;
  getPreset(presetName: string): Promise<GrantTree | any>;
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
