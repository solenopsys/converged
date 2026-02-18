import type {
  TelegramService,
  TelegramMessageInput,
  TelegramSendResult,
} from "./types";

export class TelegramServiceImpl implements TelegramService {
  async sendMessage(input: TelegramMessageInput): Promise<TelegramSendResult> {
    const url = `https://api.telegram.org/bot${input.botToken}/sendMessage`;
    const payload: Record<string, unknown> = {
      chat_id: input.chatId,
      text: input.text,
    };

    if (input.parseMode) {
      payload.parse_mode = input.parseMode;
    }

    if (input.disableWebPagePreview !== undefined) {
      payload.disable_web_page_preview = input.disableWebPagePreview;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await this.safeJson(response);

      if (!response.ok || !data?.ok) {
        return {
          success: false,
          error: data?.description ?? `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data?.result?.message_id,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async safeJson(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}

export default TelegramServiceImpl;
