// Auto-generated package
import { createHttpClient } from "nrpc";

export type ISODateString = string;

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  grantTypes: string[];
  trusted: boolean;
  createdAt: ISODateString;
}

export interface OAuthClientInput {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  grantTypes: string[];
  trusted: boolean;
}

export interface OAuthClientUpdate {
  clientSecret?: string;
  redirectUris?: string[];
  grantTypes?: string[];
  trusted?: boolean;
}

export interface GetMagicLinkResult {
  ok: boolean;
  token: string;
  expiresAt: number;
}

export interface VerifyLinkResult {
  userId: string;
  email: string;
  returnTo?: string;
}

export interface LoginResult {
  token: string;
  userId: string;
  email: string;
}

export interface CleanupResult {
  authCodes: number;
  magicLinks: number;
  refreshTokens: number;
}

export const metadata = {
  "interfaceName": "AuthService",
  "serviceName": "auth",
  "filePath": "../types/auth.ts",
  "methods": [
    {
      "name": "getMagicLink",
      "parameters": [
        {
          "name": "email",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "returnTo",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": true
    },
    {
      "name": "verifyLink",
      "parameters": [
        {
          "name": "token",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": true
    },
    {
      "name": "login",
      "parameters": [
        {
          "name": "email",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "password",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": true
    },
    {
      "name": "logout",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "clientId",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": true
    },
    {
      "name": "createOAuthClient",
      "parameters": [
        {
          "name": "client",
          "type": "OAuthClientInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": true
    },
    {
      "name": "getOAuthClient",
      "parameters": [
        {
          "name": "clientId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": false
    },
    {
      "name": "updateOAuthClient",
      "parameters": [
        {
          "name": "clientId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "updates",
          "type": "OAuthClientUpdate",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": false
    },
    {
      "name": "listOAuthClients",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": false
    },
    {
      "name": "deleteOAuthClient",
      "parameters": [
        {
          "name": "clientId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": false
    },
    {
      "name": "cleanupExpired",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": false
    }
  ],
  "types": [
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "OAuthClient",
      "definition": "",
      "properties": [
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
          "name": "redirectUris",
          "type": "string",
          "optional": false,
          "isArray": true
        },
        {
          "name": "grantTypes",
          "type": "string",
          "optional": false,
          "isArray": true
        },
        {
          "name": "trusted",
          "type": "boolean",
          "optional": false,
          "isArray": false
        },
        {
          "name": "createdAt",
          "type": "ISODateString",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "OAuthClientInput",
      "definition": "",
      "properties": [
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
          "name": "redirectUris",
          "type": "string",
          "optional": false,
          "isArray": true
        },
        {
          "name": "grantTypes",
          "type": "string",
          "optional": false,
          "isArray": true
        },
        {
          "name": "trusted",
          "type": "boolean",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "OAuthClientUpdate",
      "definition": "",
      "properties": [
        {
          "name": "clientSecret",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "redirectUris",
          "type": "string",
          "optional": true,
          "isArray": true
        },
        {
          "name": "grantTypes",
          "type": "string",
          "optional": true,
          "isArray": true
        },
        {
          "name": "trusted",
          "type": "boolean",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "GetMagicLinkResult",
      "definition": "",
      "properties": [
        {
          "name": "ok",
          "type": "boolean",
          "optional": false,
          "isArray": false
        },
        {
          "name": "token",
          "type": "string",
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
    },
    {
      "name": "VerifyLinkResult",
      "definition": "",
      "properties": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "email",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "returnTo",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "LoginResult",
      "definition": "",
      "properties": [
        {
          "name": "token",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "email",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "CleanupResult",
      "definition": "",
      "properties": [
        {
          "name": "authCodes",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "magicLinks",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "refreshTokens",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface AuthService {
  getMagicLink(email: string, returnTo?: string): Promise<any>;
  verifyLink(token: string): Promise<any>;
  login(email: string, password: string): Promise<any>;
  logout(userId: string, clientId?: string): Promise<any>;
  createOAuthClient(client: OAuthClientInput): Promise<any>;
  getOAuthClient(clientId: string): Promise<any>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<any>;
  listOAuthClients(): Promise<any>;
  deleteOAuthClient(clientId: string): Promise<any>;
  cleanupExpired(): Promise<any>;
}

// Client interface
export interface AuthServiceClient {
  getMagicLink(email: string, returnTo?: string): Promise<any>;
  verifyLink(token: string): Promise<any>;
  login(email: string, password: string): Promise<any>;
  logout(userId: string, clientId?: string): Promise<any>;
  createOAuthClient(client: OAuthClientInput): Promise<any>;
  getOAuthClient(clientId: string): Promise<any>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<any>;
  listOAuthClients(): Promise<any>;
  deleteOAuthClient(clientId: string): Promise<any>;
  cleanupExpired(): Promise<any>;
}

// Factory function
export function createAuthServiceClient(
  config?: { baseUrl?: string },
): AuthServiceClient {
  return createHttpClient<AuthServiceClient>(metadata, config);
}

// Ready-to-use client
export const authClient = createAuthServiceClient();
