// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type ISODateString = string;

export type User = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
  preset?: string;
  createdAt: ISODateString;
};

export type UserInput = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
  preset?: string;
};

export type UserUpdate = {
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  preset?: string;
};

export type AuthMethod = {
  userId: string;
  provider: string;
  providerUserId: string;
  email: string;
  lastUsedAt: ISODateString;
};

const metadata: ServiceMetadata = {
  "interfaceName": "IdentityService",
  "serviceName": "identity",
  "filePath": "services/sequrity/identity.ts",
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
      "returnType": "User | any",
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
      "returnType": "User | any",
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
      "returnType": "AuthMethod | any",
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
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "User",
      "kind": "type",
      "definition": "{\n  id: string;\n  email: string;\n  name: string;\n  picture?: string;\n  emailVerified: boolean;\n  preset?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "UserInput",
      "kind": "type",
      "definition": "{\n  id: string;\n  email: string;\n  name: string;\n  picture?: string;\n  emailVerified?: boolean;\n  preset?: string;\n}"
    },
    {
      "name": "UserUpdate",
      "kind": "type",
      "definition": "{\n  email?: string;\n  name?: string;\n  picture?: string;\n  emailVerified?: boolean;\n  preset?: string;\n}"
    },
    {
      "name": "AuthMethod",
      "kind": "type",
      "definition": "{\n  userId: string;\n  provider: string;\n  providerUserId: string;\n  email: string;\n  lastUsedAt: ISODateString;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface IdentityServiceRtClient {
  createUser(user: UserInput): User;
  listUsers(): User[];
  getUser(userId: string): User | any;
  getUserByEmail(email: string): User | any;
  updateUser(userId: string, updates: UserUpdate): User;
  deleteUser(userId: string): boolean;
  linkAuthMethod(userId: string, provider: string, providerUserId: string, email: string): void;
  unlinkAuthMethod(userId: string, provider: string): void;
  getAuthMethodByProvider(provider: string, providerUserId: string): AuthMethod | any;
  getUserAuthMethods(userId: string): AuthMethod[];
}

export function createIdentityServiceRtClient(): IdentityServiceRtClient {
  return createRtClient<IdentityServiceRtClient>(metadata);
}
