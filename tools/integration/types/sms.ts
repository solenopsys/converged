export type SmsMessageInput = {
  to: string;
  text: string;
  from?: string;
  messagingProfileId?: string;
};

export type SmsCredentials = {
  apiKey: string;
  from?: string;
  messagingProfileId?: string;
};

export type SmsSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export interface SmsService {
  sendSms(input: SmsMessageInput, credentials: SmsCredentials): Promise<SmsSendResult>;
}
