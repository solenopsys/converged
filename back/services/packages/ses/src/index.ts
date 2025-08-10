
import { EmailPayload, EmailResult, SesCredentials, SesEmailService } from './types';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export default class Ses implements SesEmailService {
	async sendEmail(payload: EmailPayload, credentials: SesCredentials): Promise<EmailResult> {
		const client = new SESClient({
			region: credentials.region,
			credentials: {
				accessKeyId: credentials.accessKeyId,
				secretAccessKey: credentials.secretAccessKey,
			},
		});


		try {
			const command = new SendEmailCommand({
				Source: payload.from,
				Destination: {
					ToAddresses: Array.isArray(payload.to) ? payload.to : [payload.to],
				},
				Message: {
					Subject: { Data: payload.subject, Charset: 'UTF-8' },
					Body: {
						Text: payload.type === 'text' ? { Data: payload.body, Charset: 'UTF-8' } : undefined,
						Html: payload.type === 'html' ? { Data: payload.body, Charset: 'UTF-8' } : undefined,
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
