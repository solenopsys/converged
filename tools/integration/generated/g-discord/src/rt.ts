// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type DiscordWebhookMessageInput = {
  webhookUrl: string;
  content: string;
  username?: string;
  avatarUrl?: string;
  tts?: boolean;
};

export type DiscordBotMessageInput = {
  botToken: string;
  channelId: string;
  content: string;
  tts?: boolean;
};

export type DiscordSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

const metadata: ServiceMetadata = {
  "interfaceName": "DiscordService",
  "serviceName": "discord",
  "filePath": "services/social/discord.ts",
  "methods": [
    {
      "name": "sendWebhookMessage",
      "parameters": [
        {
          "name": "input",
          "type": "DiscordWebhookMessageInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "DiscordSendResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "sendBotMessage",
      "parameters": [
        {
          "name": "input",
          "type": "DiscordBotMessageInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "DiscordSendResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "DiscordWebhookMessageInput",
      "kind": "type",
      "definition": "{\n  webhookUrl: string;\n  content: string;\n  username?: string;\n  avatarUrl?: string;\n  tts?: boolean;\n}"
    },
    {
      "name": "DiscordBotMessageInput",
      "kind": "type",
      "definition": "{\n  botToken: string;\n  channelId: string;\n  content: string;\n  tts?: boolean;\n}"
    },
    {
      "name": "DiscordSendResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n  messageId?: string;\n  error?: string;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface DiscordServiceRtClient {
  sendWebhookMessage(input: DiscordWebhookMessageInput): DiscordSendResult;
  sendBotMessage(input: DiscordBotMessageInput): DiscordSendResult;
}

export function createDiscordServiceRtClient(): DiscordServiceRtClient {
  return createRtClient<DiscordServiceRtClient>(metadata);
}
