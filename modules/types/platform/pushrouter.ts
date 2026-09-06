/**
 * Business push notifications: "a letter arrived", "a new order", "the printer
 * finished". Hosted by the Fujin process itself rather than the microservice
 * runtime, because delivery is a property of the live WebSocket sessions Fujin
 * already owns.
 *
 * @nrpcTarget fujin
 */

export type PushLevel = "info" | "success" | "warning" | "error";

export type PushLink = {
  surface?: string;
  ref?: string;
  href?: string;
};

/**
 * Text travels as a translation key plus parameters, never as a rendered
 * sentence: the sending service does not know the recipient's locale. `title`
 * and `body` stay available for genuine data (an email subject, an order
 * number) that no catalog can hold.
 */
export type PushMessageInput = {
  name: string;
  /** Recipient subject. Omitted means every session in the scope. */
  user?: string;
  /** Tenant. Service callers may address another scope; user callers cannot. */
  scope?: string;
  level?: PushLevel;
  titleKey?: string;
  title?: string;
  bodyKey?: string;
  body?: string;
  params?: Record<string, string | number>;
  link?: PushLink;
  payload?: unknown;
};

export type PushMessage = {
  id: string;
  name: string;
  level: PushLevel;
  at: number;
  titleKey?: string;
  title?: string;
  bodyKey?: string;
  body?: string;
  params?: Record<string, string | number>;
  link?: PushLink;
  payload?: unknown;
};

export type PushPublishResult = {
  id: string;
  /** Live sessions the message reached. Zero means nobody was connected. */
  delivered: number;
};

export type PushHistory = {
  count: number;
  messages: PushMessage[];
};

export interface PushRouterService {
  /** Publishes one notification. Callable from a browser and from services. */
  publish(message: PushMessageInput): Promise<PushPublishResult>;
  /** Replay for the calling subject only — never takes a user parameter. */
  history(limit?: number): Promise<PushHistory>;
}
