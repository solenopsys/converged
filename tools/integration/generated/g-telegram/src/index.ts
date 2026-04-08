// Auto-generated package
import { createHttpClient } from "nrpc";

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

export const metadata = {
  "interfaceName": "TelegramService",
  "serviceName": "telegram",
  "filePath": "../types/telegram.ts",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "TelegramChatId",
      "definition": "string | number"
    },
    {
      "name": "TelegramParseMode",
      "definition": "\"Markdown\" | \"MarkdownV2\" | \"HTML\""
    },
    {
      "name": "TelegramMessageInput",
      "definition": "{\n  botToken: string;\n  chatId: TelegramChatId;\n  text: string;\n  parseMode?: TelegramParseMode;\n  disableWebPagePreview?: boolean;\n}"
    },
    {
      "name": "TelegramSendResult",
      "definition": "{\n  success: boolean;\n  messageId?: number;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface TelegramService {
  sendMessage(input: TelegramMessageInput): Promise<any>;
}

// Client interface
export interface TelegramServiceClient {
  sendMessage(input: TelegramMessageInput): Promise<any>;
}

// Factory function
export function createTelegramServiceClient(
  config?: { baseUrl?: string },
): TelegramServiceClient {
  return createHttpClient<TelegramServiceClient>(metadata, config);
}

// Ready-to-use client
export const telegramClient = createTelegramServiceClient();
