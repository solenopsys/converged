// Auto-generated package
import { createHttpClient } from "nrpc";

export type OAuthProviderName = | "google"
  | "apple"
  | "microsoft"
  | "meta"
  | "github";

export interface OAuthProviderTemplate {
  provider: OAuthProviderName;
  displayName: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
}

export interface OAuthProvider {
  provider: OAuthProviderName;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
  enabled: boolean;
  createdAt: number;
}

export interface OAuthProviderInput {
  provider: OAuthProviderName;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
  enabled?: boolean;
}

export interface OAuthProviderUpdate {
  clientId?: string;
  clientSecret?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  scopes?: string[];
  enabled?: boolean;
}

export interface OAuthState {
  state: string;
  returnTo: string;
  provider: OAuthProviderName;
  expiresAt: number;
}

export const metadata = {
  "interfaceName": "OAuthService",
  "serviceName": "oauth",
  "filePath": "../types/oauth.ts",
  "methods": [
    {
      "name": "listProviderTemplates",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listProviders",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listEnabledProviders",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "definition": "",
      "properties": [
        {
          "name": "provider",
          "type": "OAuthProviderName",
          "optional": false,
          "isArray": false
        },
        {
          "name": "displayName",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "authorizeUrl",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "tokenUrl",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "userinfoUrl",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "scopes",
          "type": "string",
          "optional": false,
          "isArray": true
        }
      ]
    },
    {
      "name": "OAuthProvider",
      "definition": "",
      "properties": [
        {
          "name": "provider",
          "type": "OAuthProviderName",
          "optional": false,
          "isArray": false
        },
        {
          "name": "clientId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "clientSecret",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "authorizeUrl",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "tokenUrl",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "userinfoUrl",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "scopes",
          "type": "string",
          "optional": false,
          "isArray": true
        },
        {
          "name": "enabled",
          "type": "boolean",
          "optional": false,
          "isArray": false
        },
        {
          "name": "createdAt",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "OAuthProviderInput",
      "definition": "",
      "properties": [
        {
          "name": "provider",
          "type": "OAuthProviderName",
          "optional": false,
          "isArray": false
        },
        {
          "name": "clientId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "clientSecret",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "authorizeUrl",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "tokenUrl",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "userinfoUrl",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "scopes",
          "type": "string",
          "optional": false,
          "isArray": true
        },
        {
          "name": "enabled",
          "type": "boolean",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "OAuthProviderUpdate",
      "definition": "",
      "properties": [
        {
          "name": "clientId",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "clientSecret",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "authorizeUrl",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "tokenUrl",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "userinfoUrl",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "scopes",
          "type": "string",
          "optional": true,
          "isArray": true
        },
        {
          "name": "enabled",
          "type": "boolean",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "OAuthState",
      "definition": "",
      "properties": [
        {
          "name": "state",
          "type": "string",
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
          "name": "provider",
          "type": "OAuthProviderName",
          "optional": false,
          "isArray": false
        },
        {
          "name": "expiresAt",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface OAuthService {
  listProviderTemplates(): Promise<any>;
  getProviderTemplate(provider: OAuthProviderName): Promise<any>;
  createProvider(provider: OAuthProviderInput): Promise<any>;
  getProvider(provider: OAuthProviderName): Promise<any>;
  updateProvider(providerName: OAuthProviderName, updates: OAuthProviderUpdate): Promise<any>;
  deleteProvider(providerName: OAuthProviderName): Promise<any>;
  listProviders(): Promise<any>;
  listEnabledProviders(): Promise<any>;
  enableProvider(providerName: OAuthProviderName): Promise<any>;
  disableProvider(providerName: OAuthProviderName): Promise<any>;
  isProviderEnabled(providerName: OAuthProviderName): Promise<any>;
  createState(state: OAuthState): Promise<any>;
  getState(stateToken: string): Promise<any>;
  deleteState(stateToken: string): Promise<any>;
  consumeState(stateToken: string): Promise<any>;
  cleanupExpiredStates(): Promise<any>;
  generateState(provider: OAuthProviderName, returnTo: string, ttlSeconds?: number): Promise<any>;
}

// Client interface
export interface OAuthServiceClient {
  listProviderTemplates(): Promise<any>;
  getProviderTemplate(provider: OAuthProviderName): Promise<any>;
  createProvider(provider: OAuthProviderInput): Promise<any>;
  getProvider(provider: OAuthProviderName): Promise<any>;
  updateProvider(providerName: OAuthProviderName, updates: OAuthProviderUpdate): Promise<any>;
  deleteProvider(providerName: OAuthProviderName): Promise<any>;
  listProviders(): Promise<any>;
  listEnabledProviders(): Promise<any>;
  enableProvider(providerName: OAuthProviderName): Promise<any>;
  disableProvider(providerName: OAuthProviderName): Promise<any>;
  isProviderEnabled(providerName: OAuthProviderName): Promise<any>;
  createState(state: OAuthState): Promise<any>;
  getState(stateToken: string): Promise<any>;
  deleteState(stateToken: string): Promise<any>;
  consumeState(stateToken: string): Promise<any>;
  cleanupExpiredStates(): Promise<any>;
  generateState(provider: OAuthProviderName, returnTo: string, ttlSeconds?: number): Promise<any>;
}

// Factory function
export function createOAuthServiceClient(
  config?: { baseUrl?: string },
): OAuthServiceClient {
  return createHttpClient<OAuthServiceClient>(metadata, config);
}

// Ready-to-use client
export const oauthClient = createOAuthServiceClient();
