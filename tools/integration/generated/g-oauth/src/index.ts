// Auto-generated package
import { createHttpClient } from "nrpc";

export type OAuthProviderName = | "google"
  | "apple"
  | "microsoft"
  | "meta"
  | "github";

export type OAuthProviderTemplate = {
  provider: OAuthProviderName;
  displayName: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
};

export type OAuthProvider = {
  provider: OAuthProviderName;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
  enabled: boolean;
  createdAt: number;
};

export type OAuthProviderInput = {
  provider: OAuthProviderName;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
  enabled?: boolean;
};

export type OAuthProviderUpdate = {
  clientId?: string;
  clientSecret?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  scopes?: string[];
  enabled?: boolean;
};

export type OAuthState = {
  state: string;
  returnTo: string;
  provider: OAuthProviderName;
  expiresAt: number;
};

export const metadata = {
  "interfaceName": "OAuthService",
  "serviceName": "oauth",
  "filePath": "../types/oauth.ts",
  "methods": [
    {
      "name": "listProviderTemplates",
      "parameters": [],
      "returnType": "OAuthProviderTemplate",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getProviderTemplate",
      "parameters": [
        {
          "name": "provider",
          "type": "OAuthProviderName",
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
      "name": "createProvider",
      "parameters": [
        {
          "name": "provider",
          "type": "OAuthProviderInput",
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
      "name": "getProvider",
      "parameters": [
        {
          "name": "provider",
          "type": "OAuthProviderName",
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
      "name": "updateProvider",
      "parameters": [
        {
          "name": "providerName",
          "type": "OAuthProviderName",
          "optional": false,
          "isArray": false
        },
        {
          "name": "updates",
          "type": "OAuthProviderUpdate",
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
      "name": "deleteProvider",
      "parameters": [
        {
          "name": "providerName",
          "type": "OAuthProviderName",
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
      "name": "listProviders",
      "parameters": [],
      "returnType": "OAuthProvider",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "listEnabledProviders",
      "parameters": [],
      "returnType": "OAuthProvider",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "enableProvider",
      "parameters": [
        {
          "name": "providerName",
          "type": "OAuthProviderName",
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
      "name": "disableProvider",
      "parameters": [
        {
          "name": "providerName",
          "type": "OAuthProviderName",
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
      "name": "isProviderEnabled",
      "parameters": [
        {
          "name": "providerName",
          "type": "OAuthProviderName",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createState",
      "parameters": [
        {
          "name": "state",
          "type": "OAuthState",
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
      "name": "getState",
      "parameters": [
        {
          "name": "stateToken",
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
      "name": "deleteState",
      "parameters": [
        {
          "name": "stateToken",
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
      "name": "consumeState",
      "parameters": [
        {
          "name": "stateToken",
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
      "name": "cleanupExpiredStates",
      "parameters": [],
      "returnType": "number",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "generateState",
      "parameters": [
        {
          "name": "provider",
          "type": "OAuthProviderName",
          "optional": false,
          "isArray": false
        },
        {
          "name": "returnTo",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "ttlSeconds",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "OAuthProviderName",
      "definition": "| \"google\"\n  | \"apple\"\n  | \"microsoft\"\n  | \"meta\"\n  | \"github\""
    },
    {
      "name": "OAuthProviderTemplate",
      "definition": "{\n  provider: OAuthProviderName;\n  displayName: string;\n  authorizeUrl: string;\n  tokenUrl: string;\n  userinfoUrl: string;\n  scopes: string[];\n}"
    },
    {
      "name": "OAuthProvider",
      "definition": "{\n  provider: OAuthProviderName;\n  clientId: string;\n  clientSecret: string;\n  authorizeUrl: string;\n  tokenUrl: string;\n  userinfoUrl: string;\n  scopes: string[];\n  enabled: boolean;\n  createdAt: number;\n}"
    },
    {
      "name": "OAuthProviderInput",
      "definition": "{\n  provider: OAuthProviderName;\n  clientId: string;\n  clientSecret: string;\n  authorizeUrl: string;\n  tokenUrl: string;\n  userinfoUrl: string;\n  scopes: string[];\n  enabled?: boolean;\n}"
    },
    {
      "name": "OAuthProviderUpdate",
      "definition": "{\n  clientId?: string;\n  clientSecret?: string;\n  authorizeUrl?: string;\n  tokenUrl?: string;\n  userinfoUrl?: string;\n  scopes?: string[];\n  enabled?: boolean;\n}"
    },
    {
      "name": "OAuthState",
      "definition": "{\n  state: string;\n  returnTo: string;\n  provider: OAuthProviderName;\n  expiresAt: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface OAuthService {
  listProviderTemplates(): Promise<OAuthProviderTemplate[]>;
  getProviderTemplate(provider: OAuthProviderName): Promise<any>;
  createProvider(provider: OAuthProviderInput): Promise<void>;
  getProvider(provider: OAuthProviderName): Promise<any>;
  updateProvider(providerName: OAuthProviderName, updates: OAuthProviderUpdate): Promise<void>;
  deleteProvider(providerName: OAuthProviderName): Promise<void>;
  listProviders(): Promise<OAuthProvider[]>;
  listEnabledProviders(): Promise<OAuthProvider[]>;
  enableProvider(providerName: OAuthProviderName): Promise<void>;
  disableProvider(providerName: OAuthProviderName): Promise<void>;
  isProviderEnabled(providerName: OAuthProviderName): Promise<boolean>;
  createState(state: OAuthState): Promise<void>;
  getState(stateToken: string): Promise<any>;
  deleteState(stateToken: string): Promise<void>;
  consumeState(stateToken: string): Promise<any>;
  cleanupExpiredStates(): Promise<number>;
  generateState(provider: OAuthProviderName, returnTo: string, ttlSeconds?: number): Promise<string>;
}

// Client interface
export interface OAuthServiceClient {
  listProviderTemplates(): Promise<OAuthProviderTemplate[]>;
  getProviderTemplate(provider: OAuthProviderName): Promise<any>;
  createProvider(provider: OAuthProviderInput): Promise<void>;
  getProvider(provider: OAuthProviderName): Promise<any>;
  updateProvider(providerName: OAuthProviderName, updates: OAuthProviderUpdate): Promise<void>;
  deleteProvider(providerName: OAuthProviderName): Promise<void>;
  listProviders(): Promise<OAuthProvider[]>;
  listEnabledProviders(): Promise<OAuthProvider[]>;
  enableProvider(providerName: OAuthProviderName): Promise<void>;
  disableProvider(providerName: OAuthProviderName): Promise<void>;
  isProviderEnabled(providerName: OAuthProviderName): Promise<boolean>;
  createState(state: OAuthState): Promise<void>;
  getState(stateToken: string): Promise<any>;
  deleteState(stateToken: string): Promise<void>;
  consumeState(stateToken: string): Promise<any>;
  cleanupExpiredStates(): Promise<number>;
  generateState(provider: OAuthProviderName, returnTo: string, ttlSeconds?: number): Promise<string>;
}

// Factory function
export function createOAuthServiceClient(
  config?: { baseUrl?: string },
): OAuthServiceClient {
  return createHttpClient<OAuthServiceClient>(metadata, config);
}

// Ready-to-use client
export const oauthClient = createOAuthServiceClient();
