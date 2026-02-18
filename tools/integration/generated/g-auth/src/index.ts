// Auto-generated package
import { createHttpClient } from "nrpc";

export type ISODateString = string;

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
  createdAt: ISODateString;
}

export interface UserInput {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
}

export interface UserUpdate {
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
}

export interface AuthMethod {
  userId: string;
  provider: string;
  providerUserId: string;
  email: string;
  lastUsedAt: ISODateString;
}

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

export interface AuthCode {
  code: string;
  clientId: string;
  userId: string;
  codeChallenge?: string;
  expiresAt: number;
  used: boolean;
}

export interface AuthCodeInput {
  code: string;
  clientId: string;
  userId: string;
  codeChallenge?: string;
  expiresAt: number;
  used?: boolean;
}

export interface RefreshToken {
  tokenHash: string;
  clientId: string;
  userId: string;
  scope: string;
  expiresAt: number;
  revoked: boolean;
}

export interface MagicLink {
  token: string;
  email: string;
  returnTo?: string;
  expiresAt: number;
  used: boolean;
}

export interface MagicLinkInput {
  token: string;
  email: string;
  returnTo?: string;
  expiresAt: number;
  used?: boolean;
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
      "name": "createUser",
      "parameters": [
        {
          "name": "user",
          "type": "UserInput",
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
      "name": "getUser",
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
      "name": "getUserByEmail",
      "parameters": [
        {
          "name": "email",
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
      "name": "updateUser",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "updates",
          "type": "UserUpdate",
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
      "name": "deleteUser",
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
      "name": "linkAuthMethod",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "provider",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "providerUserId",
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
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "unlinkAuthMethod",
      "parameters": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "provider",
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
      "name": "getAuthMethodByProvider",
      "parameters": [
        {
          "name": "provider",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "providerUserId",
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
      "name": "getUserAuthMethods",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listOAuthClients",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createAuthCode",
      "parameters": [
        {
          "name": "authCode",
          "type": "AuthCodeInput",
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
      "name": "getAuthCode",
      "parameters": [
        {
          "name": "code",
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
      "name": "markAuthCodeAsUsed",
      "parameters": [
        {
          "name": "code",
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
      "name": "deleteAuthCode",
      "parameters": [
        {
          "name": "code",
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
      "name": "createRefreshToken",
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
          "optional": false,
          "isArray": false
        },
        {
          "name": "tokenHash",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "scope",
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
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getRefreshToken",
      "parameters": [
        {
          "name": "tokenHash",
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
      "name": "revokeRefreshToken",
      "parameters": [
        {
          "name": "tokenHash",
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
      "name": "revokeAllUserTokens",
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
      "isAsyncIterable": false
    },
    {
      "name": "createMagicLink",
      "parameters": [
        {
          "name": "magicLink",
          "type": "MagicLinkInput",
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
      "name": "getMagicLink",
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
      "isAsyncIterable": false
    },
    {
      "name": "markMagicLinkAsUsed",
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
      "isAsyncIterable": false
    },
    {
      "name": "cleanupExpired",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "User",
      "definition": "",
      "properties": [
        {
          "name": "id",
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
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "picture",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "emailVerified",
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
      "name": "UserInput",
      "definition": "",
      "properties": [
        {
          "name": "id",
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
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "picture",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "emailVerified",
          "type": "boolean",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "UserUpdate",
      "definition": "",
      "properties": [
        {
          "name": "email",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "name",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "picture",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "emailVerified",
          "type": "boolean",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "AuthMethod",
      "definition": "",
      "properties": [
        {
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "provider",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "providerUserId",
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
          "name": "lastUsedAt",
          "type": "ISODateString",
          "optional": false,
          "isArray": false
        }
      ]
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
      "name": "AuthCode",
      "definition": "",
      "properties": [
        {
          "name": "code",
          "type": "string",
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
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "codeChallenge",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "expiresAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "used",
          "type": "boolean",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "AuthCodeInput",
      "definition": "",
      "properties": [
        {
          "name": "code",
          "type": "string",
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
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "codeChallenge",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "expiresAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "used",
          "type": "boolean",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "RefreshToken",
      "definition": "",
      "properties": [
        {
          "name": "tokenHash",
          "type": "string",
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
          "name": "userId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "scope",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "expiresAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "revoked",
          "type": "boolean",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "MagicLink",
      "definition": "",
      "properties": [
        {
          "name": "token",
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
        },
        {
          "name": "expiresAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "used",
          "type": "boolean",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "MagicLinkInput",
      "definition": "",
      "properties": [
        {
          "name": "token",
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
        },
        {
          "name": "expiresAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "used",
          "type": "boolean",
          "optional": true,
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
  createUser(user: UserInput): Promise<any>;
  getUser(userId: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  updateUser(userId: string, updates: UserUpdate): Promise<any>;
  deleteUser(userId: string): Promise<any>;
  linkAuthMethod(userId: string, provider: string, providerUserId: string, email: string): Promise<any>;
  unlinkAuthMethod(userId: string, provider: string): Promise<any>;
  getAuthMethodByProvider(provider: string, providerUserId: string): Promise<any>;
  getUserAuthMethods(userId: string): Promise<any>;
  createOAuthClient(client: OAuthClientInput): Promise<any>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<any>;
  getOAuthClient(clientId: string): Promise<any>;
  listOAuthClients(): Promise<any>;
  deleteOAuthClient(clientId: string): Promise<any>;
  createAuthCode(authCode: AuthCodeInput): Promise<any>;
  getAuthCode(code: string): Promise<any>;
  markAuthCodeAsUsed(code: string): Promise<any>;
  deleteAuthCode(code: string): Promise<any>;
  createRefreshToken(userId: string, clientId: string, tokenHash: string, scope: string, expiresAt: number): Promise<any>;
  getRefreshToken(tokenHash: string): Promise<any>;
  revokeRefreshToken(tokenHash: string): Promise<any>;
  revokeAllUserTokens(userId: string, clientId?: string): Promise<any>;
  createMagicLink(magicLink: MagicLinkInput): Promise<any>;
  getMagicLink(token: string): Promise<any>;
  markMagicLinkAsUsed(token: string): Promise<any>;
  cleanupExpired(): Promise<any>;
}

// Client interface
export interface AuthServiceClient {
  createUser(user: UserInput): Promise<any>;
  getUser(userId: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  updateUser(userId: string, updates: UserUpdate): Promise<any>;
  deleteUser(userId: string): Promise<any>;
  linkAuthMethod(userId: string, provider: string, providerUserId: string, email: string): Promise<any>;
  unlinkAuthMethod(userId: string, provider: string): Promise<any>;
  getAuthMethodByProvider(provider: string, providerUserId: string): Promise<any>;
  getUserAuthMethods(userId: string): Promise<any>;
  createOAuthClient(client: OAuthClientInput): Promise<any>;
  updateOAuthClient(clientId: string, updates: OAuthClientUpdate): Promise<any>;
  getOAuthClient(clientId: string): Promise<any>;
  listOAuthClients(): Promise<any>;
  deleteOAuthClient(clientId: string): Promise<any>;
  createAuthCode(authCode: AuthCodeInput): Promise<any>;
  getAuthCode(code: string): Promise<any>;
  markAuthCodeAsUsed(code: string): Promise<any>;
  deleteAuthCode(code: string): Promise<any>;
  createRefreshToken(userId: string, clientId: string, tokenHash: string, scope: string, expiresAt: number): Promise<any>;
  getRefreshToken(tokenHash: string): Promise<any>;
  revokeRefreshToken(tokenHash: string): Promise<any>;
  revokeAllUserTokens(userId: string, clientId?: string): Promise<any>;
  createMagicLink(magicLink: MagicLinkInput): Promise<any>;
  getMagicLink(token: string): Promise<any>;
  markMagicLinkAsUsed(token: string): Promise<any>;
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
