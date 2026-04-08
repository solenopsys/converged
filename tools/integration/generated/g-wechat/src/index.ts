// Auto-generated package
import { createHttpClient } from "nrpc";

export type WeChatMessageType = "text";

export type WeChatTextMessageInput = {
  accessToken: string;
  toUser: string;
  content: string;
};

export type WeChatSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export const metadata = {
  "interfaceName": "WeChatService",
  "serviceName": "wechat",
  "filePath": "../types/wechat.ts",
  "methods": [
    {
      "name": "sendTextMessage",
      "parameters": [
        {
          "name": "input",
          "type": "WeChatTextMessageInput",
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
      "name": "WeChatMessageType",
      "definition": "\"text\""
    },
    {
      "name": "WeChatTextMessageInput",
      "definition": "{\n  accessToken: string;\n  toUser: string;\n  content: string;\n}"
    },
    {
      "name": "WeChatSendResult",
      "definition": "{\n  success: boolean;\n  messageId?: string;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface WeChatService {
  sendTextMessage(input: WeChatTextMessageInput): Promise<any>;
}

// Client interface
export interface WeChatServiceClient {
  sendTextMessage(input: WeChatTextMessageInput): Promise<any>;
}

// Factory function
export function createWeChatServiceClient(
  config?: { baseUrl?: string },
): WeChatServiceClient {
  return createHttpClient<WeChatServiceClient>(metadata, config);
}

// Ready-to-use client
export const wechatClient = createWeChatServiceClient();
