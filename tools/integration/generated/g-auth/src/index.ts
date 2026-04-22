// Auto-generated package
import { createHttpClient } from "nrpc";

export type ISODateString = string;

export type OAuthClient = {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  grantTypes: string[];
  trusted: boolean;
  createdAt: ISODateString;
};

export type OAuthClientInput = {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  grantTypes: string[];
  trusted: boolean;
};

export type OAuthClientUpdate = {
  clientSecret?: string;
  redirectUris?: string[];
  grantTypes?: string[];
  trusted?: boolean;
};

export type GetMagicLinkResult = {
  ok: boolean;
  token: string;
  expiresAt: number;
};

export type VerifyLinkResult = {
  token: string;
  userId: string;
  email: string;
  returnTo?: string;
};

export type LoginResult = {
  token: string;
  userId: string;
  email: string;
};

export type TemporaryUserResult = {
  token: string;
  userId: string;
  email: string;
  temporary: true;
};

export type CleanupResult = {
  authCodes: number;
  magicLinks: number;
  refreshTokens: number;
};

export const metadata = {
  "interfaceName": "AuthService",
  "serviceName": "auth",
  "filePath": "services/sequrity/auth.ts",
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
      "returnType": "GetMagicLinkResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "returnType": "VerifyLinkResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "returnType": "LoginResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createTemporaryUser",
      "parameters": [
        {
          "name": "sessionId",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "TemporaryUserResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "returnType": "OAuthClient",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "returnType": "OAuthClient | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "returnType": "OAuthClient",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listOAuthClients",
      "parameters": [],
      "returnType": "OAuthClient",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
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
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "cleanupExpired",
      "parameters": [],
      "returnType": "CleanupResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "OAuthClient",
      "kind": "type",
      "definition": "{\n  clientId: string;\n  clientSecret: string;\n  redirectUris: string[];\n  grantTypes: string[];\n  trusted: boolean;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "OAuthClientInput",
      "kind": "type",
      "definition": "{\n  clientId: string;\n  clientSecret: string;\n  redirectUris: string[];\n  grantTypes: string[];\n  trusted: boolean;\n}"
    },
    {
      "name": "OAuthClientUpdate",
      "kind": "type",
      "definition": "{\n  clientSecret?: string;\n  redirectUris?: string[];\n  grantTypes?: string[];\n  trusted?: boolean;\n}"
    },
    {
      "name": "GetMagicLinkResult",
      "kind": "type",
      "definition": "{\n  ok: boolean;\n  token: string;\n  expiresAt: number;\n}"
    },
    {
      "name": "VerifyLinkResult",
      "kind": "type",
      "definition": "{\n  token: string;\n  userId: string;\n  email: string;\n  returnTo?: string;\n}"
    },
    {
      "name": "LoginResult",
      "kind": "type",
      "definition": "{\n  token: string;\n  userId: string;\n  email: string;\n}"
    },
    {
      "name": "TemporaryUserResult",
      "kind": "type",
      "definition": "{\n  token: string;\n  userId: string;\n  email: string;\n  temporary: true;\n}"
    },
    {
      "name": "CleanupResult",
      "kind": "type",
      "definition": "{\n  authCodes: number;\n  magicLinks: number;\n  refreshTokens: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface AuthService {
  getMagicLink(email: string, returnTo?: string): Promise<GetMagicLinkResult>;
  verifyLink(token: string): Promise<VerifyLinkResult>;
  login(email: string, password: string): Promise<LoginResult>;
  createTemporaryUser(sessionId?: string): Promise<TemporaryUserResult>;
  logout(userId: string, clientId?: string): Promise<void>;
  createOAuthClient(client: OAuthClientInput): Promise<OAuthClient>;
  getOAuthClient(clientId: string): Promise<OAuthClient | any>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<OAuthClient>;
  listOAuthClients(): Promise<OAuthClient[]>;
  deleteOAuthClient(clientId: string): Promise<boolean>;
  cleanupExpired(): Promise<CleanupResult>;
}

// Client interface
export interface AuthServiceClient {
  getMagicLink(email: string, returnTo?: string): Promise<GetMagicLinkResult>;
  verifyLink(token: string): Promise<VerifyLinkResult>;
  login(email: string, password: string): Promise<LoginResult>;
  createTemporaryUser(sessionId?: string): Promise<TemporaryUserResult>;
  logout(userId: string, clientId?: string): Promise<void>;
  createOAuthClient(client: OAuthClientInput): Promise<OAuthClient>;
  getOAuthClient(clientId: string): Promise<OAuthClient | any>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<OAuthClient>;
  listOAuthClients(): Promise<OAuthClient[]>;
  deleteOAuthClient(clientId: string): Promise<boolean>;
  cleanupExpired(): Promise<CleanupResult>;
}

// Factory function
export function createAuthServiceClient(
  config?: { baseUrl?: string },
): AuthServiceClient {
  return createHttpClient<AuthServiceClient>(metadata, config);
}

// Ready-to-use client
export const authClient = createAuthServiceClient();
