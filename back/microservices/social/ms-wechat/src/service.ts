import type {
  WeChatService,
  WeChatTextMessageInput,
  WeChatSendResult,
} from "./types";

const BASE_URL = "https://api.weixin.qq.com/cgi-bin/message/custom/send";

export class WeChatServiceImpl implements WeChatService {
  async sendTextMessage(
    input: WeChatTextMessageInput,
  ): Promise<WeChatSendResult> {
    const url = `${BASE_URL}?access_token=${encodeURIComponent(
      input.accessToken,
    )}`;

    const payload = {
      touser: input.toUser,
      msgtype: "text",
      text: {
        content: input.content,
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await this.safeJson(response);
      if (!response.ok) {
        return {
          success: false,
          error: data?.errmsg ?? `HTTP ${response.status}`,
        };
      }

      if (data?.errcode && data?.errcode !== 0) {
        return {
          success: false,
          error: data?.errmsg ?? `errcode ${data?.errcode}`,
        };
      }

      return {
        success: true,
        messageId: data?.msgid?.toString(),
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

export default WeChatServiceImpl;
