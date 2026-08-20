// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

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

export const metadata: ServiceMetadata = {
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

// Server interface (to be implemented in microservice)
export interface AuthService {
  getMagicLink(email: string, returnTo?: string): Promise<GetMagicLinkResult>;
  consumeMagicLink(token: string): Promise<MagicLinkIdentity>;
  createRefreshSession(userId: string, clientId?: string): Promise<RefreshSessionResult>;
  refreshSession(refreshToken: string): Promise<RefreshSessionResult>;
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
  consumeMagicLink(token: string): Promise<MagicLinkIdentity>;
  createRefreshSession(userId: string, clientId?: string): Promise<RefreshSessionResult>;
  refreshSession(refreshToken: string): Promise<RefreshSessionResult>;
  logout(userId: string, clientId?: string): Promise<void>;
  createOAuthClient(client: OAuthClientInput): Promise<OAuthClient>;
  getOAuthClient(clientId: string): Promise<OAuthClient | any>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<OAuthClient>;
  listOAuthClients(): Promise<OAuthClient[]>;
  deleteOAuthClient(clientId: string): Promise<boolean>;
  cleanupExpired(): Promise<CleanupResult>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createAuthServiceClient(
  config: CrullerTransportClientConfig,
): AuthServiceClient {
  return createCrullerTransportClient<AuthServiceClient>(metadata, config);
}

export function createAuthServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): AuthServiceClient {
  return createAuthServiceClient(config);
}
