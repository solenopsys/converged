// Auto-generated package
import { createHttpClient } from "nrpc";

export type NotifyTemplateId = string;

export type NotifySendId = string;

export type ISODateString = string;

export type NotifyTemplate = {
  id: NotifyTemplateId;
  content: Record<string, string>;
};

export type NotifyTemplateInput = {
  id: NotifyTemplateId;
  content: Record<string, string>;
};

export type NotifySend = {
  id: NotifySendId;
  templateId: NotifyTemplateId;
  channel: string;
  recipient: string;
  params: Record<string, string | number | boolean | null>;
  status: string;
  createdAt: ISODateString;
};

export type NotifySendInput = {
  templateId: NotifyTemplateId;
  channel: string;
  recipient: string;
  params?: Record<string, string | number | boolean | null>;
  status?: string;
};

export type NotifyChannelId = string;

export type NotifyChannel = {
  id: NotifyChannelId;
  type: string;
  config: Record<string, any>;
};

export type NotifyChannelInput = {
  id: NotifyChannelId;
  type: string;
  config: Record<string, any>;
};

export const metadata = {
  "interfaceName": "NotifyService",
  "serviceName": "notify",
  "filePath": "../types/notify.ts",
  "methods": [
    {
      "name": "saveTemplate",
      "parameters": [
        {
          "name": "template",
          "type": "NotifyTemplateInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "NotifyTemplateId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getTemplate",
      "parameters": [
        {
          "name": "id",
          "type": "NotifyTemplateId",
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
      "name": "listTemplates",
      "parameters": [],
      "returnType": "NotifyTemplate",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "deleteTemplate",
      "parameters": [
        {
          "name": "id",
          "type": "NotifyTemplateId",
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
      "name": "saveChannel",
      "parameters": [
        {
          "name": "channel",
          "type": "NotifyChannelInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "NotifyChannelId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getChannel",
      "parameters": [
        {
          "name": "id",
          "type": "NotifyChannelId",
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
      "name": "listChannels",
      "parameters": [],
      "returnType": "NotifyChannel",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "deleteChannel",
      "parameters": [
        {
          "name": "id",
          "type": "NotifyChannelId",
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
      "name": "recordSend",
      "parameters": [
        {
          "name": "input",
          "type": "NotifySendInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "NotifySendId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getSend",
      "parameters": [
        {
          "name": "id",
          "type": "NotifySendId",
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
      "name": "listSends",
      "parameters": [],
      "returnType": "NotifySend",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "NotifyTemplateId",
      "definition": "string"
    },
    {
      "name": "NotifySendId",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "NotifyTemplate",
      "definition": "{\n  id: NotifyTemplateId;\n  content: Record<string, string>;\n}"
    },
    {
      "name": "NotifyTemplateInput",
      "definition": "{\n  id: NotifyTemplateId;\n  content: Record<string, string>;\n}"
    },
    {
      "name": "NotifySend",
      "definition": "{\n  id: NotifySendId;\n  templateId: NotifyTemplateId;\n  channel: string;\n  recipient: string;\n  params: Record<string, string | number | boolean | null>;\n  status: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "NotifySendInput",
      "definition": "{\n  templateId: NotifyTemplateId;\n  channel: string;\n  recipient: string;\n  params?: Record<string, string | number | boolean | null>;\n  status?: string;\n}"
    },
    {
      "name": "NotifyChannelId",
      "definition": "string"
    },
    {
      "name": "NotifyChannel",
      "definition": "{\n  id: NotifyChannelId;\n  type: string;\n  config: Record<string, any>;\n}"
    },
    {
      "name": "NotifyChannelInput",
      "definition": "{\n  id: NotifyChannelId;\n  type: string;\n  config: Record<string, any>;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface NotifyService {
  saveTemplate(template: NotifyTemplateInput): Promise<NotifyTemplateId>;
  getTemplate(id: NotifyTemplateId): Promise<any>;
  listTemplates(): Promise<NotifyTemplate[]>;
  deleteTemplate(id: NotifyTemplateId): Promise<boolean>;
  saveChannel(channel: NotifyChannelInput): Promise<NotifyChannelId>;
  getChannel(id: NotifyChannelId): Promise<any>;
  listChannels(): Promise<NotifyChannel[]>;
  deleteChannel(id: NotifyChannelId): Promise<boolean>;
  recordSend(input: NotifySendInput): Promise<NotifySendId>;
  getSend(id: NotifySendId): Promise<any>;
  listSends(): Promise<NotifySend[]>;
}

// Client interface
export interface NotifyServiceClient {
  saveTemplate(template: NotifyTemplateInput): Promise<NotifyTemplateId>;
  getTemplate(id: NotifyTemplateId): Promise<any>;
  listTemplates(): Promise<NotifyTemplate[]>;
  deleteTemplate(id: NotifyTemplateId): Promise<boolean>;
  saveChannel(channel: NotifyChannelInput): Promise<NotifyChannelId>;
  getChannel(id: NotifyChannelId): Promise<any>;
  listChannels(): Promise<NotifyChannel[]>;
  deleteChannel(id: NotifyChannelId): Promise<boolean>;
  recordSend(input: NotifySendInput): Promise<NotifySendId>;
  getSend(id: NotifySendId): Promise<any>;
  listSends(): Promise<NotifySend[]>;
}

// Factory function
export function createNotifyServiceClient(
  config?: { baseUrl?: string },
): NotifyServiceClient {
  return createHttpClient<NotifyServiceClient>(metadata, config);
}

// Ready-to-use client
export const notifyClient = createNotifyServiceClient();
