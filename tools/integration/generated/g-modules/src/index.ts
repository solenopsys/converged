// Auto-generated package
import { createHttpClient } from "nrpc";

export interface Module {
  name: string;
  link: string;
  protected: boolean;
  locales: Record;
}

export interface ModuleDefinition {
  name: string;
  remote: boolean;
  protected: boolean;
}

export interface ModulePreset {
  name: string;
  modules: string[];
}

export interface UserModuleConfig {
  presets: string[];
  additions: string[];
  removals: string[];
}

export const metadata = {
  "interfaceName": "ModulesService",
  "serviceName": "modules",
  "filePath": "../types/modules.ts",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listPresets",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listModules",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "Module",
      "definition": "",
      "properties": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "link",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "protected",
          "type": "boolean",
          "optional": false,
          "isArray": false
        },
        {
          "name": "locales",
          "type": "Record",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "ModuleDefinition",
      "definition": "",
      "properties": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "remote",
          "type": "boolean",
          "optional": false,
          "isArray": false
        },
        {
          "name": "protected",
          "type": "boolean",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "ModulePreset",
      "definition": "",
      "properties": [
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
      ]
    },
    {
      "name": "UserModuleConfig",
      "definition": "",
      "properties": [
        {
          "name": "presets",
          "type": "string",
          "optional": false,
          "isArray": true
        },
        {
          "name": "additions",
          "type": "string",
          "optional": false,
          "isArray": true
        },
        {
          "name": "removals",
          "type": "string",
          "optional": false,
          "isArray": true
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ModulesService {
  listForUser(userId: string): Promise<any>;
  getUserConfig(userId: string): Promise<any>;
  addModuleToUser(userId: string, moduleName: string): Promise<any>;
  removeModuleFromUser(userId: string, moduleName: string): Promise<any>;
  linkPresetToUser(userId: string, presetName: string): Promise<any>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<any>;
  createPreset(name: string, modules: string[]): Promise<any>;
  updatePreset(name: string, modules: string[]): Promise<any>;
  deletePreset(name: string): Promise<any>;
  getPreset(name: string): Promise<any>;
  listPresets(): Promise<any>;
  registerModule(module: ModuleDefinition): Promise<any>;
  unregisterModule(name: string): Promise<any>;
  getModule(name: string): Promise<any>;
  listModules(): Promise<any>;
}

// Client interface
export interface ModulesServiceClient {
  listForUser(userId: string): Promise<any>;
  getUserConfig(userId: string): Promise<any>;
  addModuleToUser(userId: string, moduleName: string): Promise<any>;
  removeModuleFromUser(userId: string, moduleName: string): Promise<any>;
  linkPresetToUser(userId: string, presetName: string): Promise<any>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<any>;
  createPreset(name: string, modules: string[]): Promise<any>;
  updatePreset(name: string, modules: string[]): Promise<any>;
  deletePreset(name: string): Promise<any>;
  getPreset(name: string): Promise<any>;
  listPresets(): Promise<any>;
  registerModule(module: ModuleDefinition): Promise<any>;
  unregisterModule(name: string): Promise<any>;
  getModule(name: string): Promise<any>;
  listModules(): Promise<any>;
}

// Factory function
export function createModulesServiceClient(
  config?: { baseUrl?: string },
): ModulesServiceClient {
  return createHttpClient<ModulesServiceClient>(metadata, config);
}

// Ready-to-use client
export const modulesClient = createModulesServiceClient();
