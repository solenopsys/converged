// Auto-generated frontend client
import { createHttpClient } from "nrpc";

export type MailingStatistic = {
  warmedMailCount: number;
  mailCount: number;
  date: string;
};

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export interface Mail {
  id: string;
  subject: string;
  sender: string;
  recipient: string;
  date: string;
}

export interface OutMail {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
}

export interface Credential {
  id: string;
  username: string;
  email: string;
  password: string;
  group_name: string;
  fio: string;
}

export interface EmailAddress {
  address: string;
  name: string;
}

export interface EmailAddressGroup {
  value: EmailAddress[];
  html: string;
  text: string;
}

export interface AttachmentContent {
  type: any;
  data: number[];
}

export interface Attachment {
  type: any;
  content: AttachmentContent;
  contentType: string;
  partId: string;
  release: any;
  headers: Record;
  checksum: string;
  size: number;
}

export interface EmailMessage {
  from: EmailAddressGroup;
  to: EmailAddressGroup;
  subject: string;
  date: string;
  text: string;
  html: any;
  attachments: Attachment[];
}

const metadata = {
  interfaceName: "MailingService",
  serviceName: "mailing",
  filePath: "/home/alexstorm/distrib/4ir/CONVERGED/private/types/mailing.ts",
  methods: [
    {
      name: "getStatistic",
      parameters: [],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
    {
      name: "getDailyStatistic",
      parameters: [],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
    {
      name: "listInMails",
      parameters: [
        {
          name: "params",
          type: "PaginationParams",
          optional: false,
          isArray: false,
        },
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
    {
      name: "listWarmMails",
      parameters: [
        {
          name: "params",
          type: "PaginationParams",
          optional: false,
          isArray: false,
        },
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
    {
      name: "listOutMails",
      parameters: [
        {
          name: "params",
          type: "PaginationParams",
          optional: false,
          isArray: false,
        },
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
    {
      name: "listCredentials",
      parameters: [
        {
          name: "params",
          type: "PaginationParams",
          optional: false,
          isArray: false,
        },
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
    {
      name: "getMail",
      parameters: [
        {
          name: "id",
          type: "string",
          optional: false,
          isArray: false,
        },
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
  ],
  types: [
    {
      name: "MailingStatistic",
      definition:
        "{\n    warmedMailCount: number;\n    mailCount: number;\n    date: string;\n}",
    },
    {
      name: "PaginationParams",
      definition: "",
      properties: [
        {
          name: "offset",
          type: "number",
          optional: false,
          isArray: false,
        },
        {
          name: "limit",
          type: "number",
          optional: false,
          isArray: false,
        },
      ],
    },
    {
      name: "PaginatedResult",
      definition: "",
      properties: [
        {
          name: "items",
          type: "T",
          optional: false,
          isArray: true,
        },
        {
          name: "totalCount",
          type: "number",
          optional: true,
          isArray: false,
        },
      ],
    },
    {
      name: "Mail",
      definition: "",
      properties: [
        {
          name: "id",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "subject",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "sender",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "recipient",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "date",
          type: "string",
          optional: false,
          isArray: false,
        },
      ],
    },
    {
      name: "OutMail",
      definition: "",
      properties: [
        {
          name: "id",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "subject",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "from",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "to",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "date",
          type: "string",
          optional: false,
          isArray: false,
        },
      ],
    },
    {
      name: "Credential",
      definition: "",
      properties: [
        {
          name: "id",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "username",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "email",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "password",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "group_name",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "fio",
          type: "string",
          optional: false,
          isArray: false,
        },
      ],
    },
    {
      name: "EmailAddress",
      definition: "",
      properties: [
        {
          name: "address",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "name",
          type: "string",
          optional: false,
          isArray: false,
        },
      ],
    },
    {
      name: "EmailAddressGroup",
      definition: "",
      properties: [
        {
          name: "value",
          type: "EmailAddress",
          optional: false,
          isArray: true,
        },
        {
          name: "html",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "text",
          type: "string",
          optional: false,
          isArray: false,
        },
      ],
    },
    {
      name: "AttachmentContent",
      definition: "",
      properties: [
        {
          name: "type",
          type: "any",
          optional: false,
          isArray: false,
        },
        {
          name: "data",
          type: "number",
          optional: false,
          isArray: true,
        },
      ],
    },
    {
      name: "Attachment",
      definition: "",
      properties: [
        {
          name: "type",
          type: "any",
          optional: false,
          isArray: false,
        },
        {
          name: "content",
          type: "AttachmentContent",
          optional: false,
          isArray: false,
        },
        {
          name: "contentType",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "partId",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "release",
          type: "any",
          optional: false,
          isArray: false,
        },
        {
          name: "headers",
          type: "Record",
          optional: false,
          isArray: false,
        },
        {
          name: "checksum",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "size",
          type: "number",
          optional: false,
          isArray: false,
        },
      ],
    },
    {
      name: "EmailMessage",
      definition: "",
      properties: [
        {
          name: "from",
          type: "EmailAddressGroup",
          optional: false,
          isArray: false,
        },
        {
          name: "to",
          type: "EmailAddressGroup",
          optional: false,
          isArray: false,
        },
        {
          name: "subject",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "date",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "text",
          type: "string",
          optional: false,
          isArray: false,
        },
        {
          name: "html",
          type: "any",
          optional: false,
          isArray: false,
        },
        {
          name: "attachments",
          type: "Attachment",
          optional: false,
          isArray: true,
        },
      ],
    },
  ],
};

// Service client interface
export interface MailingServiceClient {
  getStatistic(): Promise<any>;
  getDailyStatistic(): Promise<any>;
  listInMails(params: PaginationParams): Promise<any>;
  listWarmMails(params: PaginationParams): Promise<any>;
  listOutMails(params: PaginationParams): Promise<any>;
  listCredentials(params: PaginationParams): Promise<any>;
  getMail(id: string): Promise<any>;
}

// Factory function
export function createMailingServiceClient(config?: {
  baseUrl?: string;
}): MailingServiceClient {
  return createHttpClient<MailingServiceClient>(metadata, config);
}

// Export ready-to-use client
export const mailingClient = createMailingServiceClient({
  baseUrl: "https://console.4ir.club/services",
});
