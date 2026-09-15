import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { settings } from "back-core/settings";
import { Access } from "nrpc";
import type { EmailPayload, EmailResult, SesCredentials, SesService } from "./types";

export class SesServiceImpl implements SesService {
  @Access("internal")
  async sendEmail(
    payload: EmailPayload,
    credentials?: SesCredentials,
  ): Promise<EmailResult> {
    // The credentials belong here, not to the caller. This lambda is a deployed
    // container and has an environment; a workflow is a global script and has
    // none, so anything it had to pass would have come through the browser.
    const creds = credentials ?? settings.mail.ses();
    const client = new SESClient({
      region: creds.region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    });

    try {
      const command = new SendEmailCommand({
        Source: payload.from ?? settings.mail.from(),
        Destination: {
          ToAddresses: Array.isArray(payload.to) ? payload.to : [payload.to],
        },
        Message: {
          Subject: { Data: payload.subject, Charset: "UTF-8" },
          Body: {
            // An html letter carries its text alternative; SES sends the two
            // as multipart/alternative when both are present.
            Text:
              payload.type === "text"
                ? { Data: payload.body, Charset: "UTF-8" }
                : payload.text
                  ? { Data: payload.text, Charset: "UTF-8" }
                  : undefined,
            Html:
              payload.type === "html"
                ? { Data: payload.body, Charset: "UTF-8" }
                : undefined,
          },
        },
      });

      const result = await client.send(command);
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}

export default SesServiceImpl;
