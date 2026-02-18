import type {
  DiscordService,
  DiscordWebhookMessageInput,
  DiscordBotMessageInput,
  DiscordSendResult,
} from "./types";

export class DiscordServiceImpl implements DiscordService {
  async sendWebhookMessage(
    input: DiscordWebhookMessageInput,
  ): Promise<DiscordSendResult> {
    const url = this.withWait(input.webhookUrl);
    const payload: Record<string, unknown> = {
      content: input.content,
    };

    if (input.username) {
      payload.username = input.username;
    }

    if (input.avatarUrl) {
      payload.avatar_url = input.avatarUrl;
    }

    if (input.tts !== undefined) {
      payload.tts = input.tts;
    }

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
          error: data?.message ?? `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async sendBotMessage(
    input: DiscordBotMessageInput,
  ): Promise<DiscordSendResult> {
    const url = `https://discord.com/api/v10/channels/${input.channelId}/messages`;
    const payload: Record<string, unknown> = {
      content: input.content,
    };

    if (input.tts !== undefined) {
      payload.tts = input.tts;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${input.botToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await this.safeJson(response);

      if (!response.ok) {
        return {
          success: false,
          error: data?.message ?? `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private withWait(webhookUrl: string): string {
    if (webhookUrl.includes("wait=")) {
      return webhookUrl;
    }
    if (webhookUrl.includes("?")) {
      return `${webhookUrl}&wait=true`;
    }
    return `${webhookUrl}?wait=true`;
  }

  private async safeJson(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}

export default DiscordServiceImpl;
