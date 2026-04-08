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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listUsers",
      "parameters": [],
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
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface IdentityService {
  createUser(user: UserInput): Promise<any>;
  listUsers(): Promise<any>;
  getUser(userId: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  updateUser(userId: string, updates: UserUpdate): Promise<any>;
  deleteUser(userId: string): Promise<any>;
  linkAuthMethod(userId: string, provider: string, providerUserId: string, email: string): Promise<any>;
  unlinkAuthMethod(userId: string, provider: string): Promise<any>;
  getAuthMethodByProvider(provider: string, providerUserId: string): Promise<any>;
  getUserAuthMethods(userId: string): Promise<any>;
}

// Client interface
export interface IdentityServiceClient {
  createUser(user: UserInput): Promise<any>;
  listUsers(): Promise<any>;
  getUser(userId: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  updateUser(userId: string, updates: UserUpdate): Promise<any>;
  deleteUser(userId: string): Promise<any>;
  linkAuthMethod(userId: string, provider: string, providerUserId: string, email: string): Promise<any>;
  unlinkAuthMethod(userId: string, provider: string): Promise<any>;
  getAuthMethodByProvider(provider: string, providerUserId: string): Promise<any>;
  getUserAuthMethods(userId: string): Promise<any>;
}

// Factory function
export function createIdentityServiceClient(
  config?: { baseUrl?: string },
): IdentityServiceClient {
  return createHttpClient<IdentityServiceClient>(metadata, config);
}

// Ready-to-use client
export const identityClient = createIdentityServiceClient();
