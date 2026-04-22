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

export interface TelegramService {
  sendMessage(input: TelegramMessageInput): Promise<TelegramSendResult>;
}
