import nodemailer from 'nodemailer';
import { EmailPayload, EmailResult, SmtpCredentials } from './types';
import { EmailService } from './types';

export default class Smtp implements EmailService {
 

  async sendEmail(payload: EmailPayload, credentials: SmtpCredentials): Promise<EmailResult> {
	 
	const transporter = nodemailer.createTransport(credentials);
    try {
      const result = await transporter.sendMail({
        from: payload.from ,
        to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
        subject: payload.subject,
        text: payload.type === 'text' ? payload.body : undefined,
        html: payload.type === 'html' ? payload.body : undefined,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

 
}
