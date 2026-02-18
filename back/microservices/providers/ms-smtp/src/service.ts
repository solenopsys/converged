import nodemailer from "nodemailer";
import type { EmailPayload, EmailResult, SmtpCredentials, SmtpService } from "./types";

export class SmtpServiceImpl implements SmtpService {
  async sendEmail(
    payload: EmailPayload,
    credentials: SmtpCredentials,
  ): Promise<EmailResult> {
    const transporter = nodemailer.createTransport(credentials);

    try {
      const result = await transporter.sendMail({
        from: payload.from,
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
