// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

export type MagicLinkIdentity = {
  email: string;
  returnTo?: string;
};

export type RefreshSessionResult = {
  userId: string;
  clientId: string;
  refreshToken: string;
};

export type CleanupResult = {
  authCodes: number;
  magicLinks: number;
  refreshTokens: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "AuthService",
  "serviceName": "auth",
  "filePath": "sequrity/auth.ts",
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
      "name": "consumeMagicLink",
      "parameters": [
        {
          "name": "token",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "MagicLinkIdentity",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createRefreshSession",
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
      "returnType": "RefreshSessionResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "refreshSession",
      "parameters": [
        {
          "name": "refreshToken",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "RefreshSessionResult",
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
      "name": "MagicLinkIdentity",
      "kind": "type",
      "definition": "{\n  email: string;\n  returnTo?: string;\n}"
    },
    {
      "name": "RefreshSessionResult",
      "kind": "type",
      "definition": "{\n  userId: string;\n  clientId: string;\n  refreshToken: string;\n}"
    },
    {
      "name": "CleanupResult",
      "kind": "type",
      "definition": "{\n  authCodes: number;\n  magicLinks: number;\n  refreshTokens: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface AuthServiceRtClient {
  getMagicLink(email: string, returnTo?: string): GetMagicLinkResult;
  consumeMagicLink(token: string): MagicLinkIdentity;
  createRefreshSession(userId: string, clientId?: string): RefreshSessionResult;
  refreshSession(refreshToken: string): RefreshSessionResult;
  logout(userId: string, clientId?: string): void;
  createOAuthClient(client: OAuthClientInput): OAuthClient;
  getOAuthClient(clientId: string): OAuthClient | any;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): OAuthClient;
  listOAuthClients(): OAuthClient[];
  deleteOAuthClient(clientId: string): boolean;
  cleanupExpired(): CleanupResult;
}

export function createAuthServiceRtClient(): AuthServiceRtClient {
  return createRtClient<AuthServiceRtClient>(metadata);
}
