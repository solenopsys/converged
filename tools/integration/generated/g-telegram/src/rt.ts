// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type TelegramChatId = string | number;

export type TelegramParseMode = "Markdown" | "MarkdownV2" | "HTML";

export type TelegramMessageInput = {
  botToken: string;
  chatId: TelegramChatId;
  text: string;
  parseMode?: TelegramParseMode;
  disableWebPagePreview?: boolean;
};

export type TelegramSendResult = {
  success: boolean;
  messageId?: number;
  error?: string;
};

const metadata: ServiceMetadata = {
  "interfaceName": "TelegramService",
  "serviceName": "telegram",
  "filePath": "services/social/telegram.ts",
  "methods": [
    {
      "name": "sendMessage",
      "parameters": [
        {
          "name": "input",
          "type": "TelegramMessageInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "TelegramSendResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "TelegramChatId",
      "kind": "type",
      "definition": "string | number"
    },
    {
      "name": "TelegramParseMode",
      "kind": "type",
      "definition": "\"Markdown\" | \"MarkdownV2\" | \"HTML\""
    },
    {
      "name": "TelegramMessageInput",
      "kind": "type",
      "definition": "{\n  botToken: string;\n  chatId: TelegramChatId;\n  text: string;\n  parseMode?: TelegramParseMode;\n  disableWebPagePreview?: boolean;\n}"
    },
    {
      "name": "TelegramSendResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n  messageId?: number;\n  error?: string;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface TelegramServiceRtClient {
  sendMessage(input: TelegramMessageInput): TelegramSendResult;
}

export function createTelegramServiceRtClient(): TelegramServiceRtClient {
  return createRtClient<TelegramServiceRtClient>(metadata);
}
