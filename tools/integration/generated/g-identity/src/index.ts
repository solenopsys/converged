// Auto-generated package
import { createHttpClient } from "nrpc";

export type ISODateString = string;

export type User = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
  createdAt: ISODateString;
};

export type UserInput = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
};

export type UserUpdate = {
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
};

export type AuthMethod = {
  userId: string;
  provider: string;
  providerUserId: string;
  email: string;
  lastUsedAt: ISODateString;
};

export const metadata = {
  "interfaceName": "IdentityService",
  "serviceName": "identity",
  "filePath": "../types/identity.ts",
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
      "returnType": "User",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listUsers",
      "parameters": [],
      "returnType": "User",
      "isAsync": true,
      "returnTypeIsArray": true,
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
      "returnType": "User",
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
      "returnType": "boolean",
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
      "returnType": "void",
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
      "returnType": "void",
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
      "returnType": "AuthMethod",
      "isAsync": true,
      "returnTypeIsArray": true,
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
      "definition": "{\n  id: string;\n  email: string;\n  name: string;\n  picture?: string;\n  emailVerified: boolean;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "UserInput",
      "definition": "{\n  id: string;\n  email: string;\n  name: string;\n  picture?: string;\n  emailVerified?: boolean;\n}"
    },
    {
      "name": "UserUpdate",
      "definition": "{\n  email?: string;\n  name?: string;\n  picture?: string;\n  emailVerified?: boolean;\n}"
    },
    {
      "name": "AuthMethod",
      "definition": "{\n  userId: string;\n  provider: string;\n  providerUserId: string;\n  email: string;\n  lastUsedAt: ISODateString;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface IdentityService {
  createUser(user: UserInput): Promise<User>;
  listUsers(): Promise<User[]>;
  getUser(userId: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  updateUser(userId: string, updates: UserUpdate): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;
  linkAuthMethod(userId: string, provider: string, providerUserId: string, email: string): Promise<void>;
  unlinkAuthMethod(userId: string, provider: string): Promise<void>;
  getAuthMethodByProvider(provider: string, providerUserId: string): Promise<any>;
  getUserAuthMethods(userId: string): Promise<AuthMethod[]>;
}

// Client interface
export interface IdentityServiceClient {
  createUser(user: UserInput): Promise<User>;
  listUsers(): Promise<User[]>;
  getUser(userId: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  updateUser(userId: string, updates: UserUpdate): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;
  linkAuthMethod(userId: string, provider: string, providerUserId: string, email: string): Promise<void>;
  unlinkAuthMethod(userId: string, provider: string): Promise<void>;
  getAuthMethodByProvider(provider: string, providerUserId: string): Promise<any>;
  getUserAuthMethods(userId: string): Promise<AuthMethod[]>;
}

// Factory function
export function createIdentityServiceClient(
  config?: { baseUrl?: string },
): IdentityServiceClient {
  return createHttpClient<IdentityServiceClient>(metadata, config);
}

// Ready-to-use client
export const identityClient = createIdentityServiceClient();
