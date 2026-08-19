import type {
  SmsService,
  SmsMessageInput,
  SmsCredentials,
  SmsSendResult,
} from "./types";

const TELNYX_URL = "https://api.telnyx.com/v2/messages";

export class SmsServiceImpl implements SmsService {
  async sendSms(
    input: SmsMessageInput,
    credentials: SmsCredentials,
  ): Promise<SmsSendResult> {
    const from = input.from ?? credentials.from;
    const messagingProfileId =
      input.messagingProfileId ?? credentials.messagingProfileId;

    if (!from && !messagingProfileId) {
      return {
        success: false,
        error: "Missing sender: provide from or messagingProfileId",
      };
    }

    const payload: Record<string, unknown> = {
      to: input.to,
      text: input.text,
    };

    if (from) {
      payload.from = from;
    }

    if (messagingProfileId) {
      payload.messaging_profile_id = messagingProfileId;
    }

    try {
      const response = await fetch(TELNYX_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await this.safeJson(response);

      if (!response.ok) {
        return {
          success: false,
          error: this.extractError(data) ?? `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data?.data?.id,
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

  private extractError(data: any): string | undefined {
    const detail = data?.errors?.[0]?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    const title = data?.errors?.[0]?.title;
    if (typeof title === "string") {
      return title;
    }
    return undefined;
  }
}

export default SmsServiceImpl;
