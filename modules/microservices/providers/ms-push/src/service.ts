import webpush from "web-push";
import type {
  PushService,
  PushMessageInput,
  PushCredentials,
  PushSendResult,
} from "./types";

export class PushServiceImpl implements PushService {
  async sendPush(
    input: PushMessageInput,
    credentials: PushCredentials,
  ): Promise<PushSendResult> {
    const options: any = {
      TTL: input.ttl,
      urgency: input.urgency,
      topic: input.topic,
      vapidDetails: {
        subject: credentials.subject,
        publicKey: credentials.vapidPublicKey,
        privateKey: credentials.vapidPrivateKey,
      },
    };

    try {
      const response = await webpush.sendNotification(
        input.subscription as any,
        input.payload ?? "",
        options,
      );

      return {
        success: true,
        statusCode: response?.statusCode,
        body: response?.body,
      };
    } catch (error: any) {
      return {
        success: false,
        statusCode: error?.statusCode,
        body: error?.body,
        error: error?.message ?? String(error),
      };
    }
  }
}

export default PushServiceImpl;
