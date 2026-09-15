import nodemailer from "nodemailer";
import { settings } from "back-core/settings";
import { Access } from "nrpc";
import type { EmailPayload, EmailResult, SmtpCredentials, SmtpService } from "./types";

export class SmtpServiceImpl implements SmtpService {
  @Access("internal")
  async sendEmail(
    payload: EmailPayload,
    credentials?: SmtpCredentials,
  ): Promise<EmailResult> {
    // Same rule as lm-ses: the relay's credentials are this container's
    // environment, never a call parameter.
    const transporter = nodemailer.createTransport(
      credentials ?? settings.mail.smtp(),
    );

    try {
      const result = await transporter.sendMail({
        from: payload.from ?? settings.mail.from(),
        to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
        subject: payload.subject,
        text: payload.type === "text" ? payload.body : undefined,
        html: payload.type === "html" ? payload.body : undefined,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}

export default SmtpServiceImpl;
