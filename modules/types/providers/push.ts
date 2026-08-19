export type PushUrgency = "very-low" | "low" | "normal" | "high";

export type WebPushKeys = {
  p256dh: string;
  auth: string;
};

export type WebPushSubscription = {
  endpoint: string;
  keys: WebPushKeys;
};

export type PushCredentials = {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subject: string;
};

export type PushMessageInput = {
  subscription: WebPushSubscription;
  payload?: string;
  ttl?: number;
  urgency?: PushUrgency;
  topic?: string;
};

export type PushSendResult = {
  success: boolean;
  statusCode?: number;
  body?: string;
  error?: string;
};

export interface PushService {
  sendPush(input: PushMessageInput, credentials: PushCredentials): Promise<PushSendResult>;
}
