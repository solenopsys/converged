// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
  "interfaceName": "NotifyService",
  "serviceName": "notify",
  "filePath": "services/communications/notify.ts",
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
      "returnType": "NotifyTemplate | any",
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
      "returnType": "NotifyChannel | any",
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
      "returnType": "NotifySend | any",
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
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "NotifySendId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "NotifyTemplate",
      "kind": "type",
      "definition": "{\n  id: NotifyTemplateId;\n  content: Record<string, string>;\n}"
    },
    {
      "name": "NotifyTemplateInput",
      "kind": "type",
      "definition": "{\n  id: NotifyTemplateId;\n  content: Record<string, string>;\n}"
    },
    {
      "name": "NotifySend",
      "kind": "type",
      "definition": "{\n  id: NotifySendId;\n  templateId: NotifyTemplateId;\n  channel: string;\n  recipient: string;\n  params: Record<string, string | number | boolean | null>;\n  status: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "NotifySendInput",
      "kind": "type",
      "definition": "{\n  templateId: NotifyTemplateId;\n  channel: string;\n  recipient: string;\n  params?: Record<string, string | number | boolean | null>;\n  status?: string;\n}"
    },
    {
      "name": "NotifyChannelId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "NotifyChannel",
      "kind": "type",
      "definition": "{\n  id: NotifyChannelId;\n  type: string;\n  config: Record<string, any>;\n}"
    },
    {
      "name": "NotifyChannelInput",
      "kind": "type",
      "definition": "{\n  id: NotifyChannelId;\n  type: string;\n  config: Record<string, any>;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface NotifyServiceRtClient {
  saveTemplate(template: NotifyTemplateInput): NotifyTemplateId;
  getTemplate(id: NotifyTemplateId): NotifyTemplate | any;
  listTemplates(): NotifyTemplate[];
  deleteTemplate(id: NotifyTemplateId): boolean;
  saveChannel(channel: NotifyChannelInput): NotifyChannelId;
  getChannel(id: NotifyChannelId): NotifyChannel | any;
  listChannels(): NotifyChannel[];
  deleteChannel(id: NotifyChannelId): boolean;
  recordSend(input: NotifySendInput): NotifySendId;
  getSend(id: NotifySendId): NotifySend | any;
  listSends(): NotifySend[];
}

export function createNotifyServiceRtClient(): NotifyServiceRtClient {
  return createRtClient<NotifyServiceRtClient>(metadata);
}
