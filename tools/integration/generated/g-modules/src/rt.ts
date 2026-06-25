// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type Module = {
  name: string;
  link: string;
  protected: boolean;
  locales: Record<string, string>;
};

export type ModuleDefinition = {
  name: string;
  remote: boolean;
  protected: boolean;
};

export type ModulePreset = {
  name: string;
  modules: string[];
};

export type UserModuleConfig = {
  presets: string[];
  additions: string[];
  removals: string[];
};

const metadata: ServiceMetadata = {
  "interfaceName": "ModulesService",
  "serviceName": "modules",
  "filePath": "services/sequrity/modules.ts",
  "methods": [
    {
      "name": "listForUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Module",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getUserConfig",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "UserModuleConfig",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "addModuleToUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "moduleName",
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
      "name": "removeModuleFromUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "moduleName",
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
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "modules",
          "type": "string",
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
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "modules",
          "type": "string",
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
          "name": "name",
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
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ModulePreset | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listPresets",
      "parameters": [],
      "returnType": "ModulePreset",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "registerModule",
      "parameters": [
        {
          "name": "module",
          "type": "ModuleDefinition",
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
      "name": "unregisterModule",
      "parameters": [
        {
          "name": "name",
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
      "name": "getModule",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ModuleDefinition | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listModules",
      "parameters": [],
      "returnType": "ModuleDefinition",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "Module",
      "kind": "type",
      "definition": "{\n  name: string;\n  link: string;\n  protected: boolean;\n  locales: Record<string, string>;\n}"
    },
    {
      "name": "ModuleDefinition",
      "kind": "type",
      "definition": "{\n  name: string;\n  remote: boolean;\n  protected: boolean;\n}"
    },
    {
      "name": "ModulePreset",
      "kind": "type",
      "definition": "{\n  name: string;\n  modules: string[];\n}"
    },
    {
      "name": "UserModuleConfig",
      "kind": "type",
      "definition": "{\n  presets: string[];\n  additions: string[];\n  removals: string[];\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface ModulesServiceRtClient {
  listForUser(userId: string): Module[];
  getUserConfig(userId: string): UserModuleConfig;
  addModuleToUser(userId: string, moduleName: string): void;
  removeModuleFromUser(userId: string, moduleName: string): void;
  linkPresetToUser(userId: string, presetName: string): void;
  unlinkPresetFromUser(userId: string, presetName: string): void;
  createPreset(name: string, modules: string[]): void;
  updatePreset(name: string, modules: string[]): void;
  deletePreset(name: string): void;
  getPreset(name: string): ModulePreset | any;
  listPresets(): ModulePreset[];
  registerModule(module: ModuleDefinition): void;
  unregisterModule(name: string): void;
  getModule(name: string): ModuleDefinition | any;
  listModules(): ModuleDefinition[];
}

export function createModulesServiceRtClient(): ModulesServiceRtClient {
  return createRtClient<ModulesServiceRtClient>(metadata);
}
