// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type ISODateString = string;

export type User = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
  preset?: string;
  /** Language of everything addressed to this person. Falls back to the
   *  company language and then to `en` — a user row is where the chain starts. */
  lang?: string;
  createdAt: ISODateString;
};

export type UserInput = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
  preset?: string;
  lang?: string;
};

export type UserUpdate = {
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  preset?: string;
  lang?: string;
};

export type InviteStatus = | "pending"
  | "sent"
  | "accepted"
  | "revoked"
  | "expired";

export type Invite = {
  id: string;
  email: string;
  name?: string;
  /** The access preset linked on first sign-in. A role is a preset file. */
  preset: string;
  /** Group tags granted alongside the preset, `tg/<tag>` in the grant tree. */
  tags: string[];
  invitedBy: string;
  status: InviteStatus;
  expiresAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** When the address actually got a letter, for the delivery column. */
  sentAt?: ISODateString;
  acceptedAt?: ISODateString;
};

export type InviteInput = {
  email: string;
  name?: string;
  preset: string;
  tags?: string[];
  invitedBy: string;
  /** Defaults to 14 days when omitted. */
  expiresAt?: ISODateString;
};

export type InviteListParams = {
  offset?: number;
  limit?: number;
  status?: InviteStatus;
  email?: string;
};

export type InviteList = {
  items: Invite[];
  totalCount: number;
};

export type AuthMethod = {
  userId: string;
  provider: string;
  providerUserId: string;
  email: string;
  lastUsedAt: ISODateString;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "IdentityService",
  "serviceName": "identity",
  "filePath": "sequrity/identity.ts",
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
    },
    {
      "name": "createInvite",
      "parameters": [
        {
          "name": "input",
          "type": "InviteInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Invite",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listInvites",
      "parameters": [
        {
          "name": "params",
          "type": "InviteListParams",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "InviteList",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getInvite",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Invite | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getInviteByEmail",
      "parameters": [
        {
          "name": "email",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Invite | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "markInviteSent",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Invite | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "revokeInvite",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Invite | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "consumeInvite",
      "parameters": [
        {
          "name": "email",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Invite | any",
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
      "name": "User",
      "kind": "type",
      "definition": "{\n  id: string;\n  email: string;\n  name: string;\n  picture?: string;\n  emailVerified: boolean;\n  preset?: string;\n  /** Language of everything addressed to this person. Falls back to the\n   *  company language and then to `en` — a user row is where the chain starts. */\n  lang?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "UserInput",
      "kind": "type",
      "definition": "{\n  id: string;\n  email: string;\n  name: string;\n  picture?: string;\n  emailVerified?: boolean;\n  preset?: string;\n  lang?: string;\n}"
    },
    {
      "name": "UserUpdate",
      "kind": "type",
      "definition": "{\n  email?: string;\n  name?: string;\n  picture?: string;\n  emailVerified?: boolean;\n  preset?: string;\n  lang?: string;\n}"
    },
    {
      "name": "InviteStatus",
      "kind": "type",
      "definition": "| \"pending\"\n  | \"sent\"\n  | \"accepted\"\n  | \"revoked\"\n  | \"expired\""
    },
    {
      "name": "Invite",
      "kind": "type",
      "definition": "{\n  id: string;\n  email: string;\n  name?: string;\n  /** The access preset linked on first sign-in. A role is a preset file. */\n  preset: string;\n  /** Group tags granted alongside the preset, `tg/<tag>` in the grant tree. */\n  tags: string[];\n  invitedBy: string;\n  status: InviteStatus;\n  expiresAt: ISODateString;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n  /** When the address actually got a letter, for the delivery column. */\n  sentAt?: ISODateString;\n  acceptedAt?: ISODateString;\n}"
    },
    {
      "name": "InviteInput",
      "kind": "type",
      "definition": "{\n  email: string;\n  name?: string;\n  preset: string;\n  tags?: string[];\n  invitedBy: string;\n  /** Defaults to 14 days when omitted. */\n  expiresAt?: ISODateString;\n}"
    },
    {
      "name": "InviteListParams",
      "kind": "type",
      "definition": "{\n  offset?: number;\n  limit?: number;\n  status?: InviteStatus;\n  email?: string;\n}"
    },
    {
      "name": "InviteList",
      "kind": "type",
      "definition": "{\n  items: Invite[];\n  totalCount: number;\n}"
    },
    {
      "name": "AuthMethod",
      "kind": "type",
      "definition": "{\n  userId: string;\n  provider: string;\n  providerUserId: string;\n  email: string;\n  lastUsedAt: ISODateString;\n}"
    }
  ]
};

// Client interface
export interface IdentityServiceClient {
  createUser(user: UserInput): Promise<User>;
  listUsers(): Promise<User[]>;
  getUser(userId: string): Promise<User | any>;
  getUserByEmail(email: string): Promise<User | any>;
  updateUser(userId: string, updates: UserUpdate): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;
  linkAuthMethod(userId: string, provider: string, providerUserId: string, email: string): Promise<void>;
  unlinkAuthMethod(userId: string, provider: string): Promise<void>;
  getAuthMethodByProvider(provider: string, providerUserId: string): Promise<AuthMethod | any>;
  getUserAuthMethods(userId: string): Promise<AuthMethod[]>;
  createInvite(input: InviteInput): Promise<Invite>;
  listInvites(params?: InviteListParams): Promise<InviteList>;
  getInvite(id: string): Promise<Invite | any>;
  getInviteByEmail(email: string): Promise<Invite | any>;
  markInviteSent(id: string): Promise<Invite | any>;
  revokeInvite(id: string): Promise<Invite | any>;
  consumeInvite(email: string): Promise<Invite | any>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createIdentityServiceClient(
  config: WebSocketClientConfig,
): IdentityServiceClient {
  return createWebSocketClient<IdentityServiceClient>(metadata, config);
}

export function createIdentityServiceWebSocketClient(
  config: WebSocketClientConfig,
): IdentityServiceClient {
  return createIdentityServiceClient(config);
}
