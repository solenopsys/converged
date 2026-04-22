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

export interface DiscordService {
  sendWebhookMessage(input: DiscordWebhookMessageInput): Promise<DiscordSendResult>;
  sendBotMessage(input: DiscordBotMessageInput): Promise<DiscordSendResult>;
}
