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

export interface WeChatService {
  sendTextMessage(input: WeChatTextMessageInput): Promise<WeChatSendResult>;
}
