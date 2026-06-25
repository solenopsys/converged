// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
  "interfaceName": "WeChatService",
  "serviceName": "wechat",
  "filePath": "services/social/wechat.ts",
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
      "returnType": "WeChatSendResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "WeChatMessageType",
      "kind": "type",
      "definition": "\"text\""
    },
    {
      "name": "WeChatTextMessageInput",
      "kind": "type",
      "definition": "{\n  accessToken: string;\n  toUser: string;\n  content: string;\n}"
    },
    {
      "name": "WeChatSendResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n  messageId?: string;\n  error?: string;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface WeChatServiceRtClient {
  sendTextMessage(input: WeChatTextMessageInput): WeChatSendResult;
}

export function createWeChatServiceRtClient(): WeChatServiceRtClient {
  return createRtClient<WeChatServiceRtClient>(metadata);
}
