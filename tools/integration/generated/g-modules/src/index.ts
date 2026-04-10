// Auto-generated package
import { createHttpClient } from "nrpc";

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
      "returnType": "any",
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
      "returnType": "any",
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
      "definition": "{\n  name: string;\n  link: string;\n  protected: boolean;\n  locales: Record<string, string>;\n}"
    },
    {
      "name": "ModuleDefinition",
      "definition": "{\n  name: string;\n  remote: boolean;\n  protected: boolean;\n}"
    },
    {
      "name": "ModulePreset",
      "definition": "{\n  name: string;\n  modules: string[];\n}"
    },
    {
      "name": "UserModuleConfig",
      "definition": "{\n  presets: string[];\n  additions: string[];\n  removals: string[];\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ModulesService {
  listForUser(userId: string): Promise<Module[]>;
  getUserConfig(userId: string): Promise<UserModuleConfig>;
  addModuleToUser(userId: string, moduleName: string): Promise<void>;
  removeModuleFromUser(userId: string, moduleName: string): Promise<void>;
  linkPresetToUser(userId: string, presetName: string): Promise<void>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<void>;
  createPreset(name: string, modules: string[]): Promise<void>;
  updatePreset(name: string, modules: string[]): Promise<void>;
  deletePreset(name: string): Promise<void>;
  getPreset(name: string): Promise<any>;
  listPresets(): Promise<ModulePreset[]>;
  registerModule(module: ModuleDefinition): Promise<void>;
  unregisterModule(name: string): Promise<void>;
  getModule(name: string): Promise<any>;
  listModules(): Promise<ModuleDefinition[]>;
}

// Client interface
export interface ModulesServiceClient {
  listForUser(userId: string): Promise<Module[]>;
  getUserConfig(userId: string): Promise<UserModuleConfig>;
  addModuleToUser(userId: string, moduleName: string): Promise<void>;
  removeModuleFromUser(userId: string, moduleName: string): Promise<void>;
  linkPresetToUser(userId: string, presetName: string): Promise<void>;
  unlinkPresetFromUser(userId: string, presetName: string): Promise<void>;
  createPreset(name: string, modules: string[]): Promise<void>;
  updatePreset(name: string, modules: string[]): Promise<void>;
  deletePreset(name: string): Promise<void>;
  getPreset(name: string): Promise<any>;
  listPresets(): Promise<ModulePreset[]>;
  registerModule(module: ModuleDefinition): Promise<void>;
  unregisterModule(name: string): Promise<void>;
  getModule(name: string): Promise<any>;
  listModules(): Promise<ModuleDefinition[]>;
}

// Factory function
export function createModulesServiceClient(
  config?: { baseUrl?: string },
): ModulesServiceClient {
  return createHttpClient<ModulesServiceClient>(metadata, config);
}

// Ready-to-use client
export const modulesClient = createModulesServiceClient();
